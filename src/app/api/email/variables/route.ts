import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { EMAIL_VARIABLE_GROUPS } from "@/lib/email-campaigns/variables";

/** The variable registry (spec §8) — exposed so the template editor's "Insert Variable" dropdown always matches exactly what the resolver actually supports, never a hand-maintained duplicate list. */
export async function GET(_request: NextRequest) {
  try {
    await requirePermission("emailTemplates", "view");
    return NextResponse.json({ groups: EMAIL_VARIABLE_GROUPS });
  } catch (error) {
    return apiError(error);
  }
}
