import type { GeneratedReport, ReportType } from "@/types/ai-reports";
import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export interface GenerateReportInput {
  reportType: ReportType;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  from: string;
  to: string;
}

export const aiReportsService = {
  async generate(input: GenerateReportInput): Promise<GeneratedReport> {
    const response = await fetch("/api/ai/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<GeneratedReport>(response);
  },

  /** Downloads the export by opening a same-origin object URL — no `<a download>` on data:/blob: needed elsewhere in the app since this file is a real fetched Blob, not an artifact preview. */
  async export(report: GeneratedReport, format: "pdf" | "docx"): Promise<void> {
    const response = await fetch("/api/ai/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, report }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({ error: "Export failed." }))) as ApiError;
      throw body;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.reportType}-report.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
