import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { aiReportGenerateSchema } from "@/lib/validation/ai-reports";
import { aiConfig } from "@/lib/ai/config";
import { generateReport } from "@/lib/ai/reports/generate-report";
import { assertWithinQuota, incrementUsage } from "@/lib/ai/usage";
import { recordAiRequest, recordAiAudit } from "@/lib/ai/audit";

export async function POST(request: NextRequest) {
  try {
    const { schoolId, id: userId } = await requirePermission("aiReports", "create");
    const input = aiReportGenerateSchema.parse(await request.json());
    await assertWithinQuota(schoolId, userId);

    const startedAt = Date.now();
    const report = await generateReport(input.reportType, {
      schoolId,
      academicYearId: input.academicYearId,
      classId: input.classId,
      sectionId: input.sectionId,
      from: input.from,
      to: input.to,
    });

    await recordAiRequest({
      schoolId,
      userId,
      module: "reports",
      model: aiConfig.model,
      status: report.narrativeError ? "error" : "success",
      responseTimeMs: Date.now() - startedAt,
      errorMessage: report.narrativeError,
    });
    await incrementUsage(schoolId, userId, aiConfig.model);
    await recordAiAudit({ schoolId, userId, action: "report.generate", module: "reports", metadata: { reportType: input.reportType } });

    return NextResponse.json(report);
  } catch (error) {
    return apiError(error);
  }
}
