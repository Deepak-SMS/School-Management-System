import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { aiAnalyticsRequestSchema } from "@/lib/validation/ai-analytics";
import { aiConfig } from "@/lib/ai/config";
import { AiProviderUnavailableError } from "@/lib/ai/providers";
import { getAttendanceOverview, getLowAttendanceStudents } from "@/lib/ai/analytics/attendance-analytics";
import { getFeesOverview, getFeeDefaulters } from "@/lib/ai/analytics/fees-analytics";
import { narrateStats } from "@/lib/ai/analytics/narrate";
import { recordAiRequest, recordAiAudit } from "@/lib/ai/audit";
import { assertWithinQuota, incrementUsage } from "@/lib/ai/usage";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { schoolId, id: userId } = await requirePermission("aiAnalytics", "view");
    const input = aiAnalyticsRequestSchema.parse(await request.json());
    await assertWithinQuota(schoolId, userId);

    const to = input.to ?? new Date();
    const from = input.from ?? new Date(to.getTime() - 30 * DAY_MS);
    const thresholdPct = input.thresholdPct ?? 75;
    const filters = { schoolId, classId: input.classId, sectionId: input.sectionId, from, to };

    const startedAt = Date.now();
    let stats: unknown;
    let extra: Record<string, unknown> = {};
    let narrateInstruction = "";

    if (input.section === "attendance") {
      const [overview, lowAttendance] = await Promise.all([
        getAttendanceOverview(filters),
        getLowAttendanceStudents({ ...filters, thresholdPct }),
      ]);
      stats = overview;
      extra = { lowAttendanceStudents: lowAttendance.slice(0, 50) };
      narrateInstruction =
        "Explain this school's attendance performance over the period in 2-4 sentences, noting the overall percentage and whether any class stands out (better or worse). If a count of students below the attendance threshold is included, mention it.";
    } else {
      const [overview, defaulters] = await Promise.all([
        getFeesOverview({ ...filters, academicYearId: input.academicYearId }),
        getFeeDefaulters({ ...filters, academicYearId: input.academicYearId }),
      ]);
      stats = overview;
      extra = { feeDefaulters: defaulters.slice(0, 50) };
      narrateInstruction =
        "Explain this school's fee collection performance over the period in 2-4 sentences: the collection percentage, total pending/overdue, and whether the defaulter count is a concern.";
    }

    let narrative: string | null = null;
    let narrativeError: string | undefined;
    try {
      narrative = await narrateStats(narrateInstruction, stats);
      await recordAiRequest({ schoolId, userId, module: "analytics", model: aiConfig.model, status: "success", responseTimeMs: Date.now() - startedAt });
    } catch (error) {
      narrativeError =
        error instanceof AiProviderUnavailableError
          ? error.message
          : "The AI narrative couldn't be generated. The statistics below are still accurate.";
      await recordAiRequest({
        schoolId,
        userId,
        module: "analytics",
        model: aiConfig.model,
        status: "error",
        responseTimeMs: Date.now() - startedAt,
        errorMessage: narrativeError,
      });
    }

    await incrementUsage(schoolId, userId, aiConfig.model);
    await recordAiAudit({ schoolId, userId, action: "analytics.view", module: "analytics", metadata: { section: input.section } });

    return NextResponse.json({ section: input.section, stats, ...extra, narrative, narrativeError, from, to });
  } catch (error) {
    return apiError(error);
  }
}
