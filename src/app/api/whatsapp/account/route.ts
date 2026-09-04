import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { getWhatsAppProviderForSchool } from "@/lib/whatsapp/registry";
import { getWhatsAppAccountSummary } from "@/lib/whatsapp/account";

/** Polled by the Connect UI every few seconds — for the mock provider this is also what performs the lazy auto-scan transition (connecting -> connected). */
export async function GET(_request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("whatsappAccount", "view");
    const provider = await getWhatsAppProviderForSchool(schoolId);
    const [status, qr, summary] = await Promise.all([
      provider.getConnectionStatus(schoolId),
      provider.getQRCode(schoolId),
      getWhatsAppAccountSummary(schoolId),
    ]);

    return NextResponse.json({
      ...status,
      provider: provider.id,
      isSimulated: provider.isSimulated,
      qrCode: qr,
      dailyMessageCount: summary.dailyMessageCount,
    });
  } catch (error) {
    return apiError(error);
  }
}
