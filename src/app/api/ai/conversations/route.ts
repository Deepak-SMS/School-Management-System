import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { listConversations } from "@/lib/ai/conversation-service";

export async function GET() {
  try {
    const { schoolId, id: userId } = await requirePermission("aiAssistant", "view");
    const data = await listConversations(schoolId, userId);
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
