import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { aiCommunicationSendSchema } from "@/lib/validation/ai-communication";
import { resolveAudience } from "@/lib/ai/communication/audience";
import { sendCommunication } from "@/lib/ai/communication/send";
import { recordAiAudit } from "@/lib/ai/audit";

/**
 * Sending is always an explicit, separately-confirmed action (spec §9) — the
 * client must call this only after the user confirms, never automatically
 * after /generate. The recipient list is never taken from the client: it's
 * re-resolved here from `audienceMode` against this school's own data, so a
 * tampered request body can't redirect a message to arbitrary addresses.
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, id: userId } = await requirePermission("aiCommunication", "create");
    const input = aiCommunicationSendSchema.parse(await request.json());

    const audience = await resolveAudience(input.audienceMode, {
      schoolId,
      classId: input.classId,
      sectionId: input.sectionId,
      thresholdPct: input.thresholdPct,
    });

    const result = await sendCommunication({ schoolId, subject: input.subject, body: input.body, recipients: audience.recipients });

    await recordAiAudit({
      schoolId,
      userId,
      action: "communication.send",
      module: "communication",
      metadata: { audienceMode: input.audienceMode, recipientCount: audience.recipients.length, ...result },
    });

    return NextResponse.json({ ...result, audienceLabel: audience.label });
  } catch (error) {
    return apiError(error);
  }
}
