import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { aiProvider } from "@/lib/ai/providers";

export async function GET() {
  try {
    await requirePermission("aiAssistant", "view");
    const status = await aiProvider.health();
    return NextResponse.json(status);
  } catch (error) {
    return apiError(error);
  }
}
