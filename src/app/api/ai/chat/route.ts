import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { aiChatInputSchema } from "@/lib/validation/ai";
import { aiConfig } from "@/lib/ai/config";
import { aiProvider, AiProviderUnavailableError } from "@/lib/ai/providers";
import { buildSchoolAssistantMessages } from "@/lib/ai/prompts/school-assistant";
import {
  createConversation,
  getOwnedConversation,
  appendMessage,
  getRecentMessages,
  prepareRegenerate,
} from "@/lib/ai/conversation-service";
import { assertWithinQuota, incrementUsage } from "@/lib/ai/usage";
import { recordAiRequest, recordAiAudit } from "@/lib/ai/audit";

/**
 * Streams an AI School Assistant reply as newline-delimited JSON events:
 * {"type":"start",conversationId} → {"type":"chunk",content} (repeated) →
 * {"type":"done",responseTimeMs} — or {"type":"error",message} in place of
 * "done" if the model fails mid-stream. See src/services/aiService.ts for the
 * client-side reader.
 */
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requirePermission("aiAssistant", "create");
  } catch (error) {
    return apiError(error);
  }
  const { schoolId, id: userId } = user;

  let input;
  try {
    input = aiChatInputSchema.parse(await request.json());
  } catch (error) {
    return apiError(error);
  }

  try {
    await assertWithinQuota(schoolId, userId);
  } catch (error) {
    return apiError(error);
  }

  // Fail fast and cleanly if Ollama is down — before persisting anything or
  // committing to a streamed response (spec §21/§23).
  const health = await aiProvider.health();
  if (!health.connected) {
    return apiError(new AiProviderUnavailableError());
  }

  let conversationId: string;
  try {
    if (input.regenerate && input.conversationId) {
      conversationId = input.conversationId;
      await prepareRegenerate(schoolId, userId, conversationId);
    } else if (input.conversationId) {
      conversationId = (await getOwnedConversation(schoolId, userId, input.conversationId)).id;
      await appendMessage(conversationId, schoolId, "user", input.message!);
    } else {
      conversationId = (await createConversation(schoolId, userId, input.message!)).id;
      await appendMessage(conversationId, schoolId, "user", input.message!);
    }
  } catch (error) {
    return apiError(error);
  }

  const history = await getRecentMessages(conversationId, 20);
  const promptMessages = buildSchoolAssistantMessages(history);

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Client already disconnected — nothing left to send to.
        }
      };

      send({ type: "start", conversationId });

      let fullContent = "";
      let status: "success" | "error" | "stopped" = "success";
      let errorMessage: string | undefined;

      try {
        for await (const chunk of aiProvider.chatStream(promptMessages, request.signal)) {
          if (chunk.content) {
            fullContent += chunk.content;
            send({ type: "chunk", content: chunk.content });
          }
        }
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        status = aborted ? "stopped" : "error";
        if (!aborted) {
          errorMessage = error instanceof AiProviderUnavailableError ? error.message : "Something went wrong while generating a response.";
          send({ type: "error", message: errorMessage });
        }
      }

      const responseTimeMs = Date.now() - startedAt;

      if (fullContent.trim()) {
        await appendMessage(conversationId, schoolId, "assistant", fullContent.trim());
      }
      await recordAiRequest({ schoolId, userId, module: "assistant", model: aiConfig.model, status, responseTimeMs, errorMessage });
      await incrementUsage(schoolId, userId, aiConfig.model);
      await recordAiAudit({ schoolId, userId, action: "chat.message", module: "assistant", metadata: { conversationId, status } });

      send({ type: "done", responseTimeMs, status });
      try {
        controller.close();
      } catch {
        // Already closed by a disconnected client — nothing to do.
      }
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
