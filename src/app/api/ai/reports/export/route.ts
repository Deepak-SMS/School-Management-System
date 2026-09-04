import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { aiReportExportSchema } from "@/lib/validation/ai-reports";
import { renderReportPdf } from "@/lib/ai/reports/export-pdf";
import { renderReportDocx } from "@/lib/ai/reports/export-docx";
import { recordAiAudit } from "@/lib/ai/audit";

const CONTENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

/** Renders an already-generated report (see /api/ai/reports/generate) to a downloadable file — no recomputation, no second LLM call. */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, id: userId } = await requirePermission("aiReports", "export");
    const input = aiReportExportSchema.parse(await request.json());

    const bytes = input.format === "pdf" ? await renderReportPdf(input.report) : await renderReportDocx(input.report);
    const extension = input.format;
    const fileName = `${input.report.reportType}-report.${extension}`;

    await recordAiAudit({ schoolId, userId, action: "report.export", module: "reports", metadata: { reportType: input.report.reportType, format: input.format } });

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[input.format],
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
