import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { getConversationWithMessages, deleteConversation } from "@/lib/ai/conversation-service";
import { recordAiAudit } from "@/lib/ai/audit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId, id: userId } = await requirePermission("aiAssistant", "view");
    const { id } = await params;
    const conversation = await getConversationWithMessages(schoolId, userId, id);
    return NextResponse.json(conversation);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId, id: userId } = await requirePermission("aiAssistant", "delete");
    const { id } = await params;
    await deleteConversation(schoolId, userId, id);
    await recordAiAudit({ schoolId, userId, action: "conversation.delete", module: "assistant", metadata: { conversationId: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
