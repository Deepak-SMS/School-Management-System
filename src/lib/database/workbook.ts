import ExcelJS from "exceljs";
import type { Dataset, DatasetColumn, DatasetRow } from "@/lib/database/datasets";

/**
 * Reading and writing the school's database as a single .xlsx workbook.
 *
 * One sheet per dataset, headers in row 1, so the file that comes out of Export
 * is the same shape the importer accepts — round-tripping a workbook is the
 * normal way to make a bulk edit.
 */

/** Excel rejects : \ / ? * [ ] in sheet names and truncates past 31 characters. */
function safeSheetName(label: string): string {
  return label.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);
}

function headerRow(sheet: ExcelJS.Worksheet, columns: DatasetColumn[]) {
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.field,
    width: Math.min(Math.max(c.header.length + 4, 12), 32),
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
  header.alignment = { vertical: "middle" };
  header.height = 20;
  // Required columns are marked in the header so a missing value is obvious
  // before upload rather than after.
  columns.forEach((c, i) => {
    if (c.required) header.getCell(i + 1).font = { bold: true, color: { argb: "FF1D4ED8" } };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

/** Every cell is written as text so Excel can't reinterpret dates or ids. */
function addRows(sheet: ExcelJS.Worksheet, columns: DatasetColumn[], rows: DatasetRow[]) {
  for (const row of rows) {
    const added = sheet.addRow(columns.map((c) => row[c.field] ?? ""));
    added.eachCell((cell) => {
      cell.numFmt = "@";
      cell.alignment = { vertical: "top", wrapText: false };
    });
  }
}

function addReadmeSheet(
  workbook: ExcelJS.Workbook,
  entries: { dataset: Dataset; columns: DatasetColumn[]; rowCount: number | null }[],
  title: string,
  notes: string[],
) {
  const sheet = workbook.addWorksheet("Read Me");
  sheet.columns = [{ width: 26 }, { width: 16 }, { width: 14 }, { width: 74 }];

  sheet.addRow([title]).font = { bold: true, size: 14 };
  sheet.addRow([]);
  for (const note of notes) sheet.addRow(["", "", "", note]);
  sheet.addRow([]);

  const head = sheet.addRow(["Sheet", "Rows", "Editable", "What it holds"]);
  head.font = { bold: true };

  for (const { dataset, rowCount } of entries) {
    sheet.addRow([
      safeSheetName(dataset.label),
      rowCount === null ? "—" : String(rowCount),
      dataset.importable ? "yes" : "read only",
      dataset.description,
    ]);
  }

  sheet.addRow([]);
  const colHead = sheet.addRow(["Sheet", "Column", "Required", "Accepted values / notes"]);
  colHead.font = { bold: true };

  for (const { dataset, columns } of entries) {
    for (const c of columns) {
      const guidance = [c.allowed ? `one of: ${c.allowed.join(", ")}` : "", c.hint ?? ""]
        .filter(Boolean)
        .join(" · ");
      sheet.addRow([safeSheetName(dataset.label), c.header, c.required ? "required" : "", guidance]);
    }
  }
}

export interface SheetSpec {
  dataset: Dataset;
  columns: DatasetColumn[];
  rows: DatasetRow[];
}

/** Builds the workbook returned by both Export and Download template. */
export async function buildWorkbook(
  sheets: SheetSpec[],
  options: { title: string; notes: string[]; includeCounts: boolean },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "School Management System";
  workbook.created = new Date();

  addReadmeSheet(
    workbook,
    sheets.map((s) => ({
      dataset: s.dataset,
      columns: s.columns,
      rowCount: options.includeCounts ? s.rows.length : null,
    })),
    options.title,
    options.notes,
  );

  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(safeSheetName(spec.dataset.label));
    headerRow(sheet, spec.columns);
    addRows(sheet, spec.columns, spec.rows);
  }

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}

export interface ReadSheet {
  /** Sheet name as it appeared in the file. */
  name: string;
  /** Header text in the order the file has it. */
  headers: string[];
  /** One entry per data row: the sheet's own row number, plus header → cell text. */
  rows: { rowNumber: number; values: Record<string, string> }[];
}

/** Turns whatever a cell holds into the trimmed text the importer validates. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const rich = value as { richText?: { text: string }[]; text?: string; result?: unknown; error?: string };
    if (Array.isArray(rich.richText)) return rich.richText.map((t) => t.text).join("").trim();
    if (rich.error) return "";
    if (rich.result !== undefined) return cellText(rich.result as ExcelJS.CellValue);
    if (typeof rich.text === "string") return rich.text.trim();
    return "";
  }
  return String(value).trim();
}

/** Reads an uploaded workbook into plain header-keyed rows. */
export async function readWorkbook(data: Buffer): Promise<ReadSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as ArrayBuffer);

  const sheets: ReadSheet[] = [];

  workbook.eachSheet((sheet) => {
    if (safeSheetName(sheet.name).toLowerCase() === "read me") return;

    const headerValues = sheet.getRow(1).values;
    if (!Array.isArray(headerValues)) return;
    // ExcelJS row values are 1-based with a leading hole.
    const headers = headerValues.slice(1).map((v) => cellText(v as ExcelJS.CellValue));
    if (headers.every((h) => !h)) return;

    const rows: ReadSheet["rows"] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const values: Record<string, string> = {};
      let hasContent = false;
      headers.forEach((header, index) => {
        if (!header) return;
        const cell = cellText(row.getCell(index + 1).value);
        values[header] = cell;
        if (cell) hasContent = true;
      });

      // Blank rows are what a spreadsheet leaves behind after a delete; they
      // are not an error and must not become an empty record.
      if (hasContent) rows.push({ rowNumber, values });
    });

    sheets.push({ name: sheet.name, headers: headers.filter(Boolean), rows });
  });

  return sheets;
}
