import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { tick } from "@/lib/whatsapp/worker";

/**
 * Manual/supplementary trigger, schoolId-scoped — a safety net for a future
 * horizontally-scaled or serverless deployment (an external cron could hit
 * this), not the primary mechanism. The in-process interval started from
 * src/instrumentation.ts already ticks every campaign on its own; this just
 * lets the UI (or an operator) nudge one school's queue forward on demand.
 */
export async function POST(_request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("whatsappCampaigns", "edit");
    const result = await tick(schoolId);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
