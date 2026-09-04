import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { tick } from "@/lib/email-campaigns/worker";

/** Manual/supplementary trigger, schoolId-scoped — a safety net for a future horizontally-scaled deployment, same role as the WhatsApp worker's equivalent endpoint. Not the primary mechanism; the in-process interval already ticks every campaign on its own. */
export async function POST(_request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("emailCampaigns", "edit");
    const result = await tick(schoolId);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
