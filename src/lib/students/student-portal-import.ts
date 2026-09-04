import { parseCsv } from "@/lib/students/student-import";
import { prisma } from "@/lib/db";

/**
 * Bulk-grant portal logins to existing students.
 *
 * Deliberately a separate, smaller engine from student-import.ts rather than a
 * generalization of it: that importer *creates* students (admission number
 * must not exist yet); this one *matches* existing students (admission number
 * must already exist) and only ever touches the login side (User,
 * SchoolMembership, Student.userId) — never the student record itself. Reuses
 * only the CSV tokenizer (`parseCsv`), which has no opinion about columns.
 */

export interface PortalImportColumn {
  header: string;
  field: string;
  required?: boolean;
  example: string;
  hint?: string;
}

export const PORTAL_IMPORT_COLUMNS: PortalImportColumn[] = [
  { header: "Admission Number", field: "admissionNumber", required: true, example: "ADM021", hint: "Must match an existing student" },
  { header: "Login Email", field: "email", required: true, example: "parent.aarav@example.com" },
  {
    header: "Temporary Password",
    field: "temporaryPassword",
    example: "",
    hint: "Optional — leave blank to auto-generate a secure one, shown after import",
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildPortalImportTemplate(): string {
  const headers = PORTAL_IMPORT_COLUMNS.map((c) => c.header);
  const example = PORTAL_IMPORT_COLUMNS.map((c) => c.example);

  const notes: string[][] = [
    [],
    ["# INSTRUCTIONS — delete these lines (and the example row) before importing, or leave them; rows starting with # are ignored."],
    [`# Required columns: ${PORTAL_IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.header).join(", ")}`],
    ["# Each row grants (or updates) the login for the student with that admission number."],
  ];
  for (const col of PORTAL_IMPORT_COLUMNS) {
    if (col.hint) notes.push([`# ${col.header}: ${col.hint}`]);
  }

  return [headers, example, ...notes].map(toCsvRow).join("\r\n");
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsvRow(cells: string[]): string {
  return cells.map((c) => escapeCell(c ?? "")).join(",");
}

export interface PortalImportParsedRow {
  lineNumber: number;
  values: Record<string, string>;
}

export interface PortalImportRowError {
  lineNumber: number;
  column?: string;
  message: string;
  rawValue?: string;
}

export interface PortalImportParseResult {
  rows: PortalImportParsedRow[];
  unknownHeaders: string[];
  missingHeaders: string[];
  errors: PortalImportRowError[];
}

export function extractPortalImportRows(text: string): PortalImportParseResult {
  const raw = parseCsv(text);
  const errors: PortalImportRowError[] = [];

  const headerRowIndex = raw.findIndex((r) => r.some((c) => c.trim() !== "" && !c.trim().startsWith("#")));
  if (headerRowIndex === -1) {
    return { rows: [], unknownHeaders: [], missingHeaders: [], errors: [{ lineNumber: 1, message: "The file is empty." }] };
  }

  const headers = raw[headerRowIndex].map((h) => h.trim());
  const byHeader = new Map(PORTAL_IMPORT_COLUMNS.map((c) => [c.header.toLowerCase(), c]));

  const columnFor: (PortalImportColumn | null)[] = headers.map((h) => byHeader.get(h.toLowerCase()) ?? null);
  const unknownHeaders = headers.filter((h, i) => h !== "" && !columnFor[i]);
  const presentFields = new Set(columnFor.filter(Boolean).map((c) => c!.field));
  const missingHeaders = PORTAL_IMPORT_COLUMNS.filter((c) => c.required && !presentFields.has(c.field)).map((c) => c.header);

  const rows: PortalImportParsedRow[] = [];
  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const cells = raw[i];
    const lineNumber = i + 1;

    const firstCell = (cells[0] ?? "").trim();
    if (firstCell.startsWith("#")) continue;
    if (cells.every((c) => c.trim() === "")) continue;

    const values: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const col = columnFor[c];
      if (col) values[col.field] = (cells[c] ?? "").trim();
    }
    rows.push({ lineNumber, values });
  }

  return { rows, unknownHeaders, missingHeaders, errors };
}

export interface PortalImportContext {
  /** Lowercased admission number -> the student it belongs to. */
  studentsByAdmissionNumber: Map<string, { id: string; firstName: string; lastName: string }>;
  /** Lowercased email -> whichever student it's already the login for (null if it belongs to a non-student account). */
  studentIdByExistingEmail: Map<string, string | null>;
}

/**
 * Loaded fresh by both /validate and /commit — validate for the preview,
 * commit again right before writing, since the roster or another admin's
 * change could have moved in between (same discipline as student-import.ts).
 */
export async function loadPortalImportContext(schoolId: string): Promise<PortalImportContext> {
  const [students, users] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true },
    }),
    prisma.user.findMany({ select: { email: true, student: { select: { id: true } } } }),
  ]);

  return {
    studentsByAdmissionNumber: new Map(
      students.map((s) => [s.admissionNumber.toLowerCase(), { id: s.id, firstName: s.firstName, lastName: s.lastName }]),
    ),
    studentIdByExistingEmail: new Map(users.map((u) => [u.email.toLowerCase(), u.student?.id ?? null])),
  };
}

/**
 * Validates one row. `seenAdmissionNumbers`/`seenEmails` catch a file that
 * reuses the same admission number or email across rows — each login is
 * granted once per batch, not layered.
 */
export function validatePortalImportRow(
  row: PortalImportParsedRow,
  context: PortalImportContext,
  seenAdmissionNumbers: Set<string>,
  seenEmails: Set<string>,
): PortalImportRowError[] {
  const errors: PortalImportRowError[] = [];
  const v = row.values;
  const at = (column: string, message: string, rawValue?: string) =>
    errors.push({ lineNumber: row.lineNumber, column, message, rawValue });

  for (const col of PORTAL_IMPORT_COLUMNS) {
    if (col.required && !(v[col.field] ?? "")) {
      at(col.header, `${col.header} is required.`);
    }
  }

  const admissionNumber = v.admissionNumber;
  let matchedStudentId: string | null = null;
  if (admissionNumber) {
    const student = context.studentsByAdmissionNumber.get(admissionNumber.toLowerCase());
    if (!student) {
      at("Admission Number", `No student found with admission number "${admissionNumber}".`, admissionNumber);
    } else {
      matchedStudentId = student.id;
      if (seenAdmissionNumbers.has(admissionNumber.toLowerCase())) {
        at("Admission Number", `Admission number "${admissionNumber}" appears more than once in this file.`, admissionNumber);
      }
      seenAdmissionNumbers.add(admissionNumber.toLowerCase());
    }
  }

  const email = v.email;
  if (email) {
    if (!EMAIL_RE.test(email)) {
      at("Login Email", `"${email}" isn't a valid email address.`, email);
    } else {
      const lower = email.toLowerCase();
      if (seenEmails.has(lower)) {
        at("Login Email", `"${email}" appears more than once in this file.`, email);
      }
      seenEmails.add(lower);

      if (context.studentIdByExistingEmail.has(lower)) {
        const owner = context.studentIdByExistingEmail.get(lower);
        if (owner !== matchedStudentId) {
          at("Login Email", `"${email}" is already someone else's login.`, email);
        }
      }
    }
  }

  const temporaryPassword = v.temporaryPassword;
  if (temporaryPassword && temporaryPassword.length < 8) {
    at("Temporary Password", "Use at least 8 characters, or leave blank to auto-generate one.", temporaryPassword);
  }

  return errors;
}
