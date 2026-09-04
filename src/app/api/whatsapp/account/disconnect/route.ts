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
    await provider.disconnect(schoolId);

    await prisma.$transaction((tx) =>
      recordAudit(tx, { schoolId, userId, action: "whatsapp.disconnect", entityType: "WhatsAppAccount", entityId: schoolId }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
