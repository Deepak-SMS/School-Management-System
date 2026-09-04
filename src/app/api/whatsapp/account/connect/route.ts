import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { getWhatsAppProviderForSchool } from "@/lib/whatsapp/registry";

export async function POST(_request: NextRequest) {
  try {
    const { schoolId, id: userId } = await requirePermission("whatsappAccount", "edit");
    const provider = await getWhatsAppProviderForSchool(schoolId);
    const qr = await provider.connect(schoolId);

    await prisma.$transaction((tx) =>
      recordAudit(tx, { schoolId, userId, action: "whatsapp.connect", entityType: "WhatsAppAccount", entityId: schoolId }),
    );

    return NextResponse.json(qr);
  } catch (error) {
    return apiError(error);
  }
}
