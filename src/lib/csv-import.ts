/**
 * Shared CSV import machinery.
 *
 * The student and employee importers both need the same three things — a
 * template generated from a column definition, a tolerant parser, and header
 * matching — so those live here and each importer supplies only its own columns
 * and row-level rules. Keeping the template and the parser derived from one
 * column list is what stops them drifting apart.
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
  /** Headers present in the file that the importer doesn't recognise. */
  unknownHeaders: string[];
  /** Required headers the file is missing entirely. */
  missingHeaders: string[];
  errors: RowError[];
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsvRow(cells: string[]): string {
  return cells.map((c) => escapeCell(c ?? "")).join(",");
}

/** Builds a downloadable template: header row, one example row, and a notes block. */
export function buildTemplate(columns: ImportColumn[], extraNotes: string[] = []): string {
  const headers = columns.map((c) => c.header);
  const example = columns.map((c) => c.example);

  // Guidance rows start with "#" so the parser skips them — administrators
  // routinely upload the file with the instructions still in it.
  const notes: string[][] = [
    [],
    ["# INSTRUCTIONS — rows starting with # are ignored, so you can leave these in."],
    [`# Required columns: ${columns.filter((c) => c.required).map((c) => c.header).join(", ")}`],
    ["# Dates must be YYYY-MM-DD."],
    ...extraNotes.map((n) => [`# ${n}`]),
  ];

  for (const col of columns) {
    if (col.allowed) notes.push([`# ${col.header}: one of ${col.allowed.join(" | ")}`]);
    else if (col.hint) notes.push([`# ${col.header}: ${col.hint}`]);
  }

  return [headers, example, ...notes].map(toCsvRow).join("\r\n");
}

/**
 * Parses CSV text into rows.
 *
 * Hand-rolled rather than a dependency: this handles what school exports
 * actually produce — quoted cells containing commas or newlines, escaped double
 * quotes, CRLF endings, and the UTF-8 BOM Excel writes.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

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

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/** Maps the file's header row onto known fields and extracts the data rows. */
export function extractRows(text: string, columns: ImportColumn[]): ParseResult {
  const raw = parseCsv(text);
  const errors: RowError[] = [];

  const headerRowIndex = raw.findIndex((r) => r.some((c) => c.trim() !== "" && !c.trim().startsWith("#")));
  if (headerRowIndex === -1) {
    return { rows: [], unknownHeaders: [], missingHeaders: [], errors: [{ lineNumber: 1, message: "The file is empty." }] };
  }

  const headers = raw[headerRowIndex].map((h) => h.trim());
  const byHeader = new Map(columns.map((c) => [c.header.toLowerCase(), c]));

  const columnFor: (ImportColumn | null)[] = headers.map((h) => byHeader.get(h.toLowerCase()) ?? null);
  const unknownHeaders = headers.filter((h, i) => h !== "" && !columnFor[i]);
  const presentFields = new Set(columnFor.filter(Boolean).map((c) => c!.field));
  const missingHeaders = columns.filter((c) => c.required && !presentFields.has(c.field)).map((c) => c.header);

  const rows: ParsedRow[] = [];
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

export const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates the enum/required rules declared on the columns themselves. */
export function validateColumnRules(row: ParsedRow, columns: ImportColumn[]): RowError[] {
  const errors: RowError[] = [];

  for (const col of columns) {
    const value = row.values[col.field] ?? "";

    if (col.required && value === "") {
      errors.push({ lineNumber: row.lineNumber, column: col.header, message: `${col.header} is required.` });
      continue;
    }
    if (value === "") continue;

    if (col.allowed && !col.allowed.includes(value.toLowerCase()) && !col.allowed.includes(value)) {
      errors.push({
        lineNumber: row.lineNumber,
        column: col.header,
        message: `"${value}" isn't valid. Use one of: ${col.allowed.join(", ")}.`,
        rawValue: value,
      });
    }
  }

  return errors;
}
