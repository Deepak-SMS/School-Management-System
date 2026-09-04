import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { whatsappContactSchema } from "@/lib/validation/whatsapp-contact";
import { normalizePhone } from "@/lib/whatsapp/phone";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("whatsappContacts", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 25)));
    const q = params.get("q")?.trim();
    const tag = params.get("tag")?.trim();
    const optedOut = params.get("optedOut");

    const where: Prisma.WhatsAppContactWhereInput = {
      schoolId,
      isActive: true,
      ...(q && { OR: [{ name: { contains: q } }, { phoneE164: { contains: q } }] }),
      ...(tag && { tagsJson: { contains: `"${tag}"` } }),
      ...(optedOut === "true" && { optedOut: true }),
      ...(optedOut === "false" && { optedOut: false }),
    };

    const [data, total] = await Promise.all([
      prisma.whatsAppContact.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.whatsAppContact.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("whatsappContacts", "create");
    const { schoolId } = user;
    const input = whatsappContactSchema.parse(await request.json());
    const normalized = normalizePhone(input.phone);
    if (!normalized.valid || !normalized.e164) {
      return NextResponse.json({ error: "Enter a valid WhatsApp number." }, { status: 422 });
    }

    const existing = await prisma.whatsAppContact.findUnique({ where: { schoolId_phoneE164: { schoolId, phoneE164: normalized.e164 } } });
    if (existing) return NextResponse.json({ error: "A contact with this phone number already exists." }, { status: 409 });

    const contact = await prisma.$transaction(async (tx) => {
      const created = await tx.whatsAppContact.create({
        data: {
          schoolId,
          source: "manual",
          name: input.name,
          phoneE164: normalized.e164!,
          rawPhone: input.phone,
          tagsJson: input.tags.length ? JSON.stringify(input.tags) : null,
          notes: input.notes,
          createdById: user.id,
        },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappContact.create", entityType: "WhatsAppContact", entityId: created.id, after: input });
      return created;
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
