import { BLOOD_GROUPS, GENDERS, STUDENT_STATUSES } from "@/lib/constants/people";

/**
 * Student bulk import.
 *
 * `IMPORT_COLUMNS` is the single source of truth: the downloadable template, the
 * parser, and the validator all read it, so a column can never exist in the
 * template but be ignored on import (or vice versa).
 *
 * The flow is deliberately validate-then-commit — nothing is written until the
 * administrator has seen the errors and confirmed the preview, so a bad file
 * can't half-import (spec: "do not partially import invalid data without
 * clearly informing the administrator").
 */

export interface ImportColumn {
  /** Header text as it appears in the CSV. */
  header: string;
  /** Key on the parsed row object. */
  field: string;
  required?: boolean;
  /** Shown in the template's example row. */
  example: string;
  /** Allowed values, when the field is an enum. */
  allowed?: readonly string[];
  hint?: string;
}

export const IMPORT_COLUMNS: ImportColumn[] = [
  // Identity
  { header: "Admission Number", field: "admissionNumber", required: true, example: "ADM021", hint: "Must be unique within the school" },
  { header: "Enrollment Number", field: "enrollmentNumber", example: "EN2026021" },
  { header: "First Name", field: "firstName", required: true, example: "Aarav" },
  { header: "Middle Name", field: "middleName", example: "Kumar" },
  { header: "Last Name", field: "lastName", required: true, example: "Sharma" },
  { header: "Date of Birth", field: "dateOfBirth", example: "2012-04-15", hint: "YYYY-MM-DD" },
  { header: "Gender", field: "gender", example: "male", allowed: GENDERS },
  { header: "Blood Group", field: "bloodGroup", example: "O+", allowed: BLOOD_GROUPS },
  { header: "Nationality", field: "nationality", example: "Indian" },
  { header: "Mother Tongue", field: "motherTongue", example: "Marathi" },
  { header: "Category", field: "category", example: "", hint: "Optional — only if your school must report it" },
  { header: "Religion", field: "religion", example: "", hint: "Optional — only if your school must report it" },

  // Academic placement
  { header: "Class", field: "className", required: true, example: "Class 6", hint: "Must match an existing class name" },
  { header: "Section", field: "sectionName", example: "A", hint: "Must be a section of that class" },
  { header: "Roll Number", field: "rollNumber", example: "21" },
  { header: "House", field: "house", example: "Amber" },
  { header: "Admission Date", field: "admissionDate", example: "2026-06-01", hint: "YYYY-MM-DD" },
  { header: "Admission Type", field: "admissionType", example: "new", allowed: ["new", "transfer", "readmission", "staff_ward", "rte"] },
  { header: "Previous School", field: "previousSchool", example: "" },
  { header: "Status", field: "status", example: "active", allowed: STUDENT_STATUSES },

  // Address
  { header: "Address Line 1", field: "address", example: "12 Lakeview Road" },
  { header: "Address Line 2", field: "addressLine2", example: "" },
  { header: "City", field: "city", example: "Pune" },
  { header: "State", field: "state", example: "Maharashtra" },
  { header: "Country", field: "country", example: "India" },
  { header: "PIN Code", field: "pinCode", example: "411045" },

  // Contact
  { header: "Primary Mobile", field: "primaryMobile", example: "+91 9812345678" },
  { header: "Student Email", field: "studentEmail", example: "" },
  { header: "Parent Email", field: "parentEmail", example: "parent@example.com" },
  { header: "WhatsApp Number", field: "whatsappNumber", example: "+91 9812345678" },

  // Guardians — father and mother cover the common case; more can be added on
  // the student's profile afterwards.
  { header: "Father Name", field: "fatherName", example: "Rajesh Sharma" },
  { header: "Father Mobile", field: "fatherMobile", example: "+91 9812345678" },
  { header: "Father Email", field: "fatherEmail", example: "" },
  { header: "Father Occupation", field: "fatherOccupation", example: "Engineer" },
  { header: "Mother Name", field: "motherName", example: "Sunita Sharma" },
  { header: "Mother Mobile", field: "motherMobile", example: "+91 9812345679" },
  { header: "Mother Email", field: "motherEmail", example: "" },
  { header: "Mother Occupation", field: "motherOccupation", example: "Teacher" },
  { header: "Primary Guardian", field: "primaryGuardian", example: "father", allowed: ["father", "mother"], hint: "Which parent is the main contact" },

  // Emergency
  { header: "Emergency Contact Name", field: "emergencyName", example: "Rajesh Sharma" },
  { header: "Emergency Relationship", field: "emergencyRelation", example: "Father" },
  { header: "Emergency Mobile", field: "emergencyContact", example: "+91 9812345678" },
];

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Builds the downloadable template: a header row, one example row, and a notes block. */
export function buildImportTemplate(): string {
  const headers = IMPORT_COLUMNS.map((c) => c.header);
  const example = IMPORT_COLUMNS.map((c) => c.example);

  // Guidance rows start with "#" so the parser can skip them — administrators
  // routinely leave them in the file they upload back.
  const notes: string[][] = [
    [],
    ["# INSTRUCTIONS — delete these lines (and the example row) before importing, or leave them; rows starting with # are ignored."],
    [`# Required columns: ${IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.header).join(", ")}`],
    ["# Dates must be YYYY-MM-DD."],
  ];
  for (const col of IMPORT_COLUMNS) {
    if (col.allowed) notes.push([`# ${col.header}: one of ${col.allowed.join(" | ")}`]);
    else if (col.hint) notes.push([`# ${col.header}: ${col.hint}`]);
  }

  return [headers, example, ...notes].map(toCsvRow).join("\r\n");
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsvRow(cells: string[]): string {
  return cells.map((c) => escapeCell(c ?? "")).join(",");
}

/**
 * Parses CSV text into rows keyed by column field.
 *
 * Hand-rolled rather than pulling in a dependency: this handles the cases a
 * school export actually produces — quoted cells containing commas or newlines,
 * escaped double quotes, CRLF endings, and a UTF-8 BOM from Excel.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  // Excel prefixes UTF-8 files with a BOM, which would otherwise become part of
  // the first header and break the column match.
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\r") {
      // handled by the \n branch
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  // Trailing cell/row when the file doesn't end with a newline.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

export interface ParsedRow {
  /** 1-based line number in the uploaded file, for error messages. */
  lineNumber: number;
  values: Record<string, string>;
}

export interface RowError {
  lineNumber: number;
  column?: string;
  message: string;
  rawValue?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Headers present in the file that this importer doesn't recognise. */
  unknownHeaders: string[];
  /** Required headers the file is missing entirely. */
  missingHeaders: string[];
  errors: RowError[];
}

/** Maps the file's header row onto known fields and extracts data rows. */
export function extractRows(text: string): ParseResult {
  const raw = parseCsv(text);
  const errors: RowError[] = [];

  const headerRowIndex = raw.findIndex((r) => r.some((c) => c.trim() !== "" && !c.trim().startsWith("#")));
  if (headerRowIndex === -1) {
    return { rows: [], unknownHeaders: [], missingHeaders: [], errors: [{ lineNumber: 1, message: "The file is empty." }] };
  }

  const headers = raw[headerRowIndex].map((h) => h.trim());
  const byHeader = new Map(IMPORT_COLUMNS.map((c) => [c.header.toLowerCase(), c]));

  const columnFor: (ImportColumn | null)[] = headers.map((h) => byHeader.get(h.toLowerCase()) ?? null);
  const unknownHeaders = headers.filter((h, i) => h !== "" && !columnFor[i]);
  const presentFields = new Set(columnFor.filter(Boolean).map((c) => c!.field));
  const missingHeaders = IMPORT_COLUMNS.filter((c) => c.required && !presentFields.has(c.field)).map((c) => c.header);

  const rows: ParsedRow[] = [];
  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const cells = raw[i];
    const lineNumber = i + 1;

    // Skip blank rows and the instruction/comment lines from the template.
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

export interface ValidationContext {
  /** Lowercased class name -> { id, sections: lowercased section name -> id }. */
  classes: Map<string, { id: string; sections: Map<string, string> }>;
  /** Admission numbers already used in this school. */
  existingAdmissionNumbers: Set<string>;
}

/**
 * Validates one row against the column rules and the school's real classes.
 * Returns the errors for that row; an empty array means the row is importable.
 */
export function validateRow(row: ParsedRow, context: ValidationContext, seenInFile: Set<string>): RowError[] {
  const errors: RowError[] = [];
  const v = row.values;
  const at = (column: string, message: string, rawValue?: string) =>
    errors.push({ lineNumber: row.lineNumber, column, message, rawValue });

  for (const col of IMPORT_COLUMNS) {
    const value = v[col.field] ?? "";

    if (col.required && value === "") {
      at(col.header, `${col.header} is required.`);
      continue;
    }
    if (value === "") continue;

    if (col.allowed && !col.allowed.includes(value.toLowerCase()) && !col.allowed.includes(value)) {
      at(col.header, `"${value}" isn't valid. Use one of: ${col.allowed.join(", ")}.`, value);
    }
  }

  // Admission number: unique in the school, and unique within the file itself.
  const admissionNumber = v.admissionNumber;
  if (admissionNumber) {
    if (context.existingAdmissionNumbers.has(admissionNumber.toLowerCase())) {
      at("Admission Number", `A student with admission number "${admissionNumber}" already exists.`, admissionNumber);
    } else if (seenInFile.has(admissionNumber.toLowerCase())) {
      at("Admission Number", `Admission number "${admissionNumber}" appears more than once in this file.`, admissionNumber);
    }
    seenInFile.add(admissionNumber.toLowerCase());
  }

  // Class and section must resolve to real records — this is the check that
  // produces "Class Mathematics does not exist" style feedback.
  const className = v.className;
  if (className) {
    const cls = context.classes.get(className.toLowerCase());
    if (!cls) {
      at("Class", `Class "${className}" does not exist.`, className);
    } else if (v.sectionName && !cls.sections.has(v.sectionName.toLowerCase())) {
      at("Section", `Section "${v.sectionName}" does not exist in ${className}.`, v.sectionName);
    }
  }

  for (const [field, header] of [
    ["dateOfBirth", "Date of Birth"],
    ["admissionDate", "Admission Date"],
  ] as const) {
    const value = v[field];
    if (value && Number.isNaN(Date.parse(value))) {
      at(header, `"${value}" isn't a valid date. Use YYYY-MM-DD.`, value);
    }
  }

  for (const [field, header] of [
    ["primaryMobile", "Primary Mobile"],
    ["whatsappNumber", "WhatsApp Number"],
    ["fatherMobile", "Father Mobile"],
    ["motherMobile", "Mother Mobile"],
    ["emergencyContact", "Emergency Mobile"],
  ] as const) {
    const value = v[field];
    if (value && !PHONE_RE.test(value)) at(header, `"${value}" isn't a valid phone number.`, value);
  }

  for (const [field, header] of [
    ["studentEmail", "Student Email"],
    ["parentEmail", "Parent Email"],
    ["fatherEmail", "Father Email"],
    ["motherEmail", "Mother Email"],
  ] as const) {
    const value = v[field];
    if (value && !EMAIL_RE.test(value)) at(header, `"${value}" isn't a valid email address.`, value);
  }

  return errors;
}
