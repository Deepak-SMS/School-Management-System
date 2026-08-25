import type { ApiError } from "@/services/studentService";

export interface DatasetSummary {
  key: string;
  label: string;
  description: string;
  importable: boolean;
  columnCount: number;
  rowCount: number;
}

export interface ImportIssue {
  sheet: string;
  row: number;
  column?: string;
  message: string;
}

export interface ImportPlan {
  sheets: { sheet: string; datasetKey: string; label: string; create: number; update: number; skipped: number }[];
  issues: ImportIssue[];
  unknownSheets: string[];
  totalCreate: number;
  totalUpdate: number;
}

export interface ImportResult {
  created: number;
  updated: number;
  bySheet: { label: string; created: number; updated: number }[];
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

/** Builds `?datasets=a,b`, or nothing at all when everything is selected. */
function query(keys: string[] | undefined): string {
  return keys && keys.length > 0 ? `?datasets=${keys.join(",")}` : "";
}

/**
 * The download endpoints stream a file rather than JSON, so they're fetched and
 * turned into a blob here — a plain link would lose the error message when the
 * server refuses.
 */
async function download(url: string, fallbackName: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "The download failed." }));
    throw body as ApiError;
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = match?.[1] ?? fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export const databaseService = {
  async listDatasets(): Promise<{ data: DatasetSummary[]; total: number }> {
    return parseOrThrow(await fetch("/api/database/datasets"));
  },

  async exportWorkbook(keys?: string[]): Promise<void> {
    await download(`/api/database/export${query(keys)}`, "school-database.xlsx");
  },

  async downloadTemplate(keys?: string[]): Promise<void> {
    await download(`/api/database/template${query(keys)}`, "school-database-template.xlsx");
  },

  async validateImport(file: File): Promise<ImportPlan> {
    const form = new FormData();
    form.append("file", file);
    return parseOrThrow(await fetch("/api/database/import/validate", { method: "POST", body: form }));
  },

  async commitImport(file: File): Promise<ImportResult> {
    const form = new FormData();
    form.append("file", file);
    return parseOrThrow(await fetch("/api/database/import/commit", { method: "POST", body: form }));
  },
};
