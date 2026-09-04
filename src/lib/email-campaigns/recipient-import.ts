import ExcelJS from "exceljs";
import { readWorkbook } from "@/lib/database/workbook";

/**
 * Excel import for one-off campaign recipients — spec §14: "Treat Excel
 * campaign data as campaign-specific recipient data unless the user
 * explicitly chooses 'Import into Students'" (that opt-in isn't built in
 * this pass — imported rows only ever become EmailJob rows for the one
 * campaign, never a persisted contact/student record). Same flexible
 * column-mapping shape as src/lib/whatsapp/contact-import.ts, since a
 * recipient list can arrive with any header names.
 */

const MAX_ROWS = 5000;
const MAX_ERRORS_SHOWN = 200;
const MAX_SAMPLE_ROWS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InspectedRecipientWorkbook {
  headers: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
}

export async function inspectRecipientWorkbook(buffer: Buffer): Promise<InspectedRecipientWorkbook> {
  const sheets = await readWorkbook(buffer);
  const sheet = sheets.find((s) => s.rows.length > 0) ?? sheets[0];
  if (!sheet) return { headers: [], sampleRows: [], totalRows: 0 };
  return { headers: sheet.headers, sampleRows: sheet.rows.slice(0, MAX_SAMPLE_ROWS).map((r) => r.values), totalRows: sheet.rows.length };
}

export interface RecipientImportMapping {
  nameColumn: string;
  emailColumn: string;
  customColumns?: string[];
}

export interface RecipientImportRowError {
  lineNumber: number;
  column?: string;
  message: string;
  rawValue?: string;
}

export interface RecipientImportValidRow {
  lineNumber: number;
  name: string;
  email: string;
  customFields: Record<string, string>;
}

export interface RecipientImportValidateResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  errors: RecipientImportRowError[];
  errorsTruncated: boolean;
  validRows: RecipientImportValidRow[];
  preview: Record<string, string>[];
}

export async function validateRecipientImport(buffer: Buffer, mapping: RecipientImportMapping): Promise<RecipientImportValidateResult> {
  const sheets = await readWorkbook(buffer);
  const sheet = sheets.find((s) => s.rows.length > 0) ?? sheets[0];
  const rows = (sheet?.rows ?? []).slice(0, MAX_ROWS);

  const errors: RecipientImportRowError[] = [];
  const validRows: RecipientImportValidRow[] = [];
  const seenEmails = new Set<string>();
  let duplicateCount = 0;

  for (const row of rows) {
    const rawName = (row.values[mapping.nameColumn] ?? "").trim();
    const rawEmail = (row.values[mapping.emailColumn] ?? "").trim().toLowerCase();

    if (!rawName) {
      errors.push({ lineNumber: row.rowNumber, column: mapping.nameColumn, message: "Name is required" });
      continue;
    }
    if (!rawEmail) {
      errors.push({ lineNumber: row.rowNumber, column: mapping.emailColumn, message: "Email is required" });
      continue;
    }
    if (!EMAIL_RE.test(rawEmail)) {
      errors.push({ lineNumber: row.rowNumber, column: mapping.emailColumn, message: "Invalid email address", rawValue: rawEmail });
      continue;
    }
    if (seenEmails.has(rawEmail)) {
      duplicateCount += 1;
      errors.push({ lineNumber: row.rowNumber, column: mapping.emailColumn, message: "Duplicate email within this file", rawValue: rawEmail });
      continue;
    }
    seenEmails.add(rawEmail);

    const customFields: Record<string, string> = {};
    for (const col of mapping.customColumns ?? []) {
      const value = row.values[col];
      if (value) customFields[col] = value;
    }

    validRows.push({ lineNumber: row.rowNumber, name: rawName, email: rawEmail, customFields });
  }

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    errorCount: errors.length,
    duplicateCount,
    errors: errors.slice(0, MAX_ERRORS_SHOWN),
    errorsTruncated: errors.length > MAX_ERRORS_SHOWN,
    validRows,
    preview: validRows.slice(0, MAX_SAMPLE_ROWS).map((r) => ({ name: r.name, email: r.email })),
  };
}

/** The "Download Sample Template" file for the recipient import wizard. */
export async function buildRecipientImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "School Management System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Recipients");
  sheet.columns = [
    { header: "Student Name", key: "student", width: 22 },
    { header: "Parent Name", key: "parent", width: 22 },
    { header: "Email", key: "email", width: 28 },
    { header: "Class", key: "class", width: 12 },
    { header: "Section", key: "section", width: 12 },
    { header: "Pending Fees", key: "pending", width: 14 },
  ];
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  sheet.addRow({ student: "Rahul Sharma", parent: "Mr. Sharma", email: "parent@example.com", class: "8", section: "A", pending: "10000" });
  sheet.addRow({ student: "Priya Patel", parent: "Mr. Patel", email: "parent2@example.com", class: "6", section: "B", pending: "15000" });

  const notes = sheet.addRow([]);
  notes.getCell(1).value = "Name and Email are required — map them to the right columns after upload. Any other column can be kept as a custom {{contact.custom.*}} variable.";
  sheet.mergeCells(`A${notes.number}:F${notes.number}`);
  notes.getCell(1).font = { italic: true, color: { argb: "FF6B7280" } };
  notes.getCell(1).alignment = { wrapText: true };

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
