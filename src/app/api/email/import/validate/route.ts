import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { validateRecipientImport } from "@/lib/email-campaigns/recipient-import";
import { emailRecipientImportMappingSchema } from "@/lib/validation/email-recipient-import";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Step 2: re-posts the same file plus the chosen column mapping. Writes nothing — the resulting rows travel with the campaign creation request itself (spec §14: campaign-specific, never a persisted Student/contact record). */
export async function POST(request: NextRequest) {
  try {
    await requirePermission("emailCampaigns", "create");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File is too large. Maximum size is 5 MB." }, { status: 422 });

    const mappingRaw = form.get("mapping");
    if (typeof mappingRaw !== "string") return NextResponse.json({ error: "Column mapping is required." }, { status: 400 });
    const mapping = emailRecipientImportMappingSchema.parse(JSON.parse(mappingRaw));

    const result = await validateRecipientImport(Buffer.from(await file.arrayBuffer()), mapping);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
