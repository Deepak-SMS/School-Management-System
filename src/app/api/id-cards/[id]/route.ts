import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const STATUS_ACTIONS = {
  activate: "active",
  expire: "expired",
  revoke: "revoked",
} as const;

const patchSchema = z.object({
  action: z.enum(["activate", "expire", "revoke"]),
  reason: z.string().trim().max(500).optional(),
});

async function findCard(schoolId: string, id: string) {
  return prisma.iDCard.findFirst({
    where: { id, schoolId },
    include: {
      template: { select: { id: true, name: true } },
      qrVerification: true,
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, photoUrl: true, class: { select: { name: true } }, section: { select: { name: true } } } },
      staff: { select: { id: true, fullName: true, employeeId: true, photoUrl: true, designation: { select: { name: true } } } },
      replacementsAsOld: { include: { newCard: { select: { id: true, status: true, issuedAt: true, cardNumber: true } } }, orderBy: { createdAt: "desc" } },
      replacementsAsNew: { include: { originalCard: { select: { id: true, status: true, issuedAt: true, cardNumber: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { schoolId } = await requirePermission("idCards", "view");
  const { id } = await params;
  const card = await findCard(schoolId, id);
  if (!card) return NextResponse.json({ error: "ID card not found." }, { status: 404 });
  return NextResponse.json(card);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("idCards", "edit");
    const { id } = await params;
    const input = patchSchema.parse(await request.json());

    const existing = await prisma.iDCard.findFirst({ where: { id, schoolId }, include: { qrVerification: true } });
    if (!existing) return NextResponse.json({ error: "ID card not found." }, { status: 404 });

    const newStatus = STATUS_ACTIONS[input.action];
    const qrShouldBeActive = newStatus === "active";

    const card = await prisma.$transaction(async (tx) => {
      const updated = await tx.iDCard.update({ where: { id }, data: { status: newStatus } });
      if (existing.qrVerification) {
        await tx.qRVerification.update({ where: { id: existing.qrVerification.id }, data: { isActive: qrShouldBeActive } });
      }
      await recordAudit(tx, {
        schoolId,
        action: `idCard.${input.action}`,
        entityType: "IDCard",
        entityId: id,
        before: { status: existing.status },
        after: { status: newStatus, reason: input.reason },
      });
      return updated;
    });

    return NextResponse.json(card);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("idCards", "delete");
    const { id } = await params;
    const existing = await prisma.iDCard.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "ID card not found." }, { status: 404 });

    if (existing.status === "active" || existing.status === "generated") {
      return NextResponse.json({ error: "This card is currently valid. Revoke it before deleting." }, { status: 409 });
    }

    const replacementCount = await prisma.cardReplacement.count({ where: { OR: [{ originalCardId: id }, { newCardId: id }] } });
    if (replacementCount > 0) {
      return NextResponse.json({ error: "This card is part of a version history and can't be deleted." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.iDCard.delete({ where: { id } });
      await recordAudit(tx, { schoolId, action: "idCard.delete", entityType: "IDCard", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
