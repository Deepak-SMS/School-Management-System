import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { whatsappTemplateSchema } from "@/lib/validation/whatsapp-template";
import { extractVariables } from "@/lib/communication/personalize";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("whatsappTemplates", "view");
    const params = request.nextUrl.searchParams;
    const category = params.get("category") ?? undefined;
    const q = params.get("q")?.trim();

    const where: Prisma.WhatsAppTemplateWhereInput = {
      schoolId,
      isActive: true,
      ...(category && { category }),
      ...(q && { name: { contains: q } }),
    };

    const data = await prisma.whatsAppTemplate.findMany({ where, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("whatsappTemplates", "create");
    const { schoolId } = user;
    const input = whatsappTemplateSchema.parse(await request.json());

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.whatsAppTemplate.create({
        data: {
          schoolId,
          name: input.name,
          category: input.category,
          bodyText: input.bodyText,
          variablesJson: JSON.stringify(extractVariables(input.bodyText)),
          isActive: input.isActive,
          createdById: user.id,
        },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappTemplate.create", entityType: "WhatsAppTemplate", entityId: created.id, after: input });
      return created;
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
