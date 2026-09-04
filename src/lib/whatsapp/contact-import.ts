import ExcelJS from "exceljs";
import { readWorkbook } from "@/lib/database/workbook";
import { normalizePhone } from "@/lib/whatsapp/phone";

/**
 * Contacts Excel import — inspect (headers + a sample) then validate against
 * a chosen column mapping. Unlike every other importer in this codebase
 * (student/staff/database bulk import), which do strict header-name matching
 * against a fixed in-app template, a WhatsApp recipient list comes from an
 * arbitrary real-world file — so this is a genuinely new column-mapping step,
 * reusing only readWorkbook() from src/lib/database/workbook.ts.
 */

const MAX_ROWS = 5000;
const MAX_ERRORS_SHOWN = 200;
const MAX_SAMPLE_ROWS = 5;

export interface InspectedWorkbook {
  headers: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
}

export async function inspectWorkbook(buffer: Buffer): Promise<InspectedWorkbook> {
  const sheets = await readWorkbook(buffer);
  const sheet = sheets.find((s) => s.rows.length > 0) ?? sheets[0];
  if (!sheet) return { headers: [], sampleRows: [], totalRows: 0 };
  return {
    headers: sheet.headers,
    sampleRows: sheet.rows.slice(0, MAX_SAMPLE_ROWS).map((r) => r.values),
    totalRows: sheet.rows.length,
  };
}

export interface ContactImportMapping {
  nameColumn: string;
  phoneColumn: string;
  tagColumns?: string[];
  customColumns?: string[];
}

export interface ContactImportRowError {
  lineNumber: number;
  column?: string;
  message: string;
  rawValue?: string;
}

export interface ContactImportValidRow {
  lineNumber: number;
  name: string;
  phoneE164: string;
  rawPhone: string;
  tags: string[];
  customFields: Record<string, string>;
}

export interface ContactImportValidateResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: ContactImportRowError[];
  errorsTruncated: boolean;
  validRows: ContactImportValidRow[];
  preview: Record<string, string>[];
}

export async function validateContactImport(buffer: Buffer, mapping: ContactImportMapping): Promise<ContactImportValidateResult> {
  const sheets = await readWorkbook(buffer);
  const sheet = sheets.find((s) => s.rows.length > 0) ?? sheets[0];
  const rows = (sheet?.rows ?? []).slice(0, MAX_ROWS);

  const errors: ContactImportRowError[] = [];
  const validRows: ContactImportValidRow[] = [];
  const seenPhones = new Set<string>();

  for (const row of rows) {
    const rawName = (row.values[mapping.nameColumn] ?? "").trim();
    const rawPhone = (row.values[mapping.phoneColumn] ?? "").trim();

    if (!rawName) {
      errors.push({ lineNumber: row.rowNumber, column: mapping.nameColumn, message: "Name is required" });
      continue;
    }
    const normalized = normalizePhone(rawPhone);
    if (!normalized.valid || !normalized.e164) {
      errors.push({ lineNumber: row.rowNumber, column: mapping.phoneColumn, message: "Invalid phone number", rawValue: rawPhone });
      continue;
    }
    if (seenPhones.has(normalized.e164)) {
      errors.push({ lineNumber: row.rowNumber, column: mapping.phoneColumn, message: "Duplicate phone number within this file", rawValue: rawPhone });
      continue;
    }
    seenPhones.add(normalized.e164);

    const tags = [...new Set((mapping.tagColumns ?? []).flatMap((col) => (row.values[col] ?? "").split(",").map((t) => t.trim()).filter(Boolean)))];
    const customFields: Record<string, string> = {};
    for (const col of mapping.customColumns ?? []) {
      const value = row.values[col];
      if (value) customFields[col] = value;
    }

    validRows.push({ lineNumber: row.rowNumber, name: rawName, phoneE164: normalized.e164, rawPhone, tags, customFields });
  }

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    errorCount: errors.length,
    errors: errors.slice(0, MAX_ERRORS_SHOWN),
    errorsTruncated: errors.length > MAX_ERRORS_SHOWN,
    validRows,
    preview: validRows.slice(0, MAX_SAMPLE_ROWS).map((r) => ({ name: r.name, phone: r.phoneE164, tags: r.tags.join(", ") })),
  };
}

/**
 * An example file for the "Download Sample Template" button — not tied to
 * the src/lib/database/workbook.ts Dataset registry (that's a fixed-schema
 * abstraction for the whole-database importer; this import accepts any
 * column layout via the mapping step, so a plain standalone sheet fits
 * better than forcing it into that shape).
 */
export async function buildContactImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "School Management System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Contacts");
  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Tags", key: "tags", width: 20 },
    { header: "Class", key: "class", width: 14 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  sheet.addRow({ name: "Rahul Sharma", phone: "9876543210", tags: "alumni", class: "8-A" });
  sheet.addRow({ name: "Priya Patel", phone: "+919812345678", tags: "donor, alumni", class: "6-B" });

  const notes = sheet.addRow([]);
  notes.getCell(1).value =
    "Name and Phone are required — map them to the right columns after upload. " +
    "Extra columns like Tags/Class are optional: mark a column as tags, or keep it as a custom {{contact.custom.*}} variable.";
  sheet.mergeCells(`A${notes.number}:D${notes.number}`);
  notes.getCell(1).font = { italic: true, color: { argb: "FF6B7280" } };
  notes.getCell(1).alignment = { wrapText: true };

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
