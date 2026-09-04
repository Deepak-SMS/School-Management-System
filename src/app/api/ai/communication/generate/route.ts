import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { aiCommunicationGenerateSchema } from "@/lib/validation/ai-communication";
import { aiConfig } from "@/lib/ai/config";
import { resolveAudience } from "@/lib/ai/communication/audience";
import { generateCommunicationDraft, splitDraft } from "@/lib/ai/communication/generate";
import { assertWithinQuota, incrementUsage } from "@/lib/ai/usage";
import { recordAiRequest, recordAiAudit } from "@/lib/ai/audit";

export async function POST(request: NextRequest) {
  try {
    const { schoolId, id: userId } = await requirePermission("aiCommunication", "create");
    const input = aiCommunicationGenerateSchema.parse(await request.json());
    await assertWithinQuota(schoolId, userId);

    const audience = await resolveAudience(input.audienceMode, {
      schoolId,
      classId: input.classId,
      sectionId: input.sectionId,
      thresholdPct: input.thresholdPct,
    });

    const startedAt = Date.now();
    try {
      const draft = await generateCommunicationDraft({
        type: input.type,
        tone: input.tone,
        language: input.language,
        context: input.context,
        audiencePromptContext: audience.promptContext,
      });
      const { subject, body } = splitDraft(draft);

      await recordAiRequest({ schoolId, userId, module: "communication", model: aiConfig.model, status: "success", responseTimeMs: Date.now() - startedAt });
      await incrementUsage(schoolId, userId, aiConfig.model);
      await recordAiAudit({ schoolId, userId, action: "communication.generate", module: "communication", metadata: { type: input.type, audienceMode: input.audienceMode } });

      return NextResponse.json({
        subject,
        body,
        audience: { label: audience.label, recipientCount: audience.recipients.length, missingEmailCount: audience.missingEmailCount },
      });
    } catch (error) {
      await recordAiRequest({
        schoolId,
        userId,
        module: "communication",
        model: aiConfig.model,
        status: "error",
        responseTimeMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
