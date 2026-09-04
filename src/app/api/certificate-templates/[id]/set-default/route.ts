import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Marks a template as the school's fixed design for its certificate type.
 * Exactly one template per type can be fixed, so setting one clears the rest
 * in the same transaction — same rule as ID card templates.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("certificateTypes", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const template = await prisma.certificateTemplate.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    if (template.isSystemTemplate || template.schoolId !== schoolId) {
      return NextResponse.json(
        { error: "This is a shared starter template. Duplicate it into your school first, then set the copy as your fixed design." },
        { status: 409 },
      );
    }
    if (!template.isActive) {
      return NextResponse.json({ error: "Reactivate this template before making it the fixed design." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.certificateTemplate.updateMany({
        where: { schoolId, certificateTypeId: template.certificateTypeId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });

      const row = await tx.certificateTemplate.update({ where: { id }, data: { isDefault: true } });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "certificateTemplate.set_default",
        entityType: "CertificateTemplate",
        entityId: id,
        after: { name: row.name, certificateTypeId: row.certificateTypeId },
      });

      return row;
    });

    return NextResponse.json({ success: true, id: updated.id, certificateTypeId: updated.certificateTypeId });
  } catch (error) {
    return apiError(error);
  }
}
