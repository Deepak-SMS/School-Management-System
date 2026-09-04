import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { certificateTypeInputSchema } from "@/lib/validation/certificate";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("certificateTypes", "view");
    const { id } = await params;

    const type = await prisma.certificateType.findFirst({ where: { id, OR: [{ isSystemType: true }, { schoolId }] } });
    if (!type) return NextResponse.json({ error: "Certificate type not found." }, { status: 404 });
    return NextResponse.json(type);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("certificateTypes", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(certificateTypeInputSchema.partial().parse(await request.json()));

    const existing = await prisma.certificateType.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Certificate type not found." }, { status: 404 });
    if (existing.isSystemType || existing.schoolId !== schoolId) {
      return NextResponse.json({ error: "System certificate types are read-only." }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.certificateType.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "certificateType.update",
        entityType: "CertificateType",
        entityId: id,
        before: existing,
        after: row,
      });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

/** Deactivates rather than deletes if any certificate or template already references this type — never lose the ability to explain an issued certificate's type. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("certificateTypes", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.certificateType.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Certificate type not found." }, { status: 404 });
    if (existing.isSystemType || existing.schoolId !== schoolId) {
      return NextResponse.json({ error: "System certificate types can't be removed." }, { status: 403 });
    }

    const inUse = await prisma.certificate.count({ where: { certificateTypeId: id } });

    const result = await prisma.$transaction(async (tx) => {
      if (inUse > 0) {
        const row = await tx.certificateType.update({ where: { id }, data: { isActive: false } });
        await recordAudit(tx, { schoolId, userId: user.id, action: "certificateType.deactivate", entityType: "CertificateType", entityId: id, before: existing, after: row });
        return { deactivated: true, certificatesIssued: inUse };
      }
      await tx.certificateType.delete({ where: { id } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "certificateType.delete", entityType: "CertificateType", entityId: id, before: existing });
      return { deactivated: false, certificatesIssued: 0 };
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
