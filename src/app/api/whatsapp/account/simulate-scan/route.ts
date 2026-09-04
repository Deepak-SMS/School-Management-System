import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { getWhatsAppProviderForSchool, asMockProvider } from "@/lib/whatsapp/registry";

/** Dev-only shortcut for the mock provider's QR flow — 404s for any real (non-simulated) provider. */
export async function POST(_request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("whatsappAccount", "edit");
    const provider = await getWhatsAppProviderForSchool(schoolId);
    const mock = asMockProvider(provider);
    if (!mock) return NextResponse.json({ error: "Not available for this provider." }, { status: 404 });

    await mock.simulateScanNow(schoolId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
