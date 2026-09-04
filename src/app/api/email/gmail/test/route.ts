import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { getEmailProvider } from "@/lib/email-campaigns/registry";

/** "Test Connection" on the Gmail settings card — a cheap real API call (users.getProfile), not a send. */
export async function POST(_request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("gmailConnection", "view");
    const result = await getEmailProvider().validateConnection(schoolId);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
