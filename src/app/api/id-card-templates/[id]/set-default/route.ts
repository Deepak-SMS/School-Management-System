import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Marks a template as the school's **fixed design** for its category.
 *
 * Exactly one template per category (student / teacher / staff) can be fixed, so
 * setting one clears the rest in the same transaction — otherwise card
 * generation would have to guess which of two defaults to print.
 *
 * System templates are shared across every school and can't be fixed directly;
 * a school duplicates one first, which is what "Save as school template" does.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("idCards", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const template = await prisma.iDCardTemplate.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    if (template.isSystemTemplate || template.schoolId !== schoolId) {
      return NextResponse.json(
        {
          error:
            "This is a shared starter template. Duplicate it into your school first, then set the copy as your fixed design.",
        },
        { status: 409 },
      );
    }

    if (!template.isActive) {
      return NextResponse.json({ error: "Reactivate this template before making it the fixed design." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // One fixed design per category — clear any previous holder first.
      await tx.iDCardTemplate.updateMany({
        where: { schoolId, category: template.category, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });

      const row = await tx.iDCardTemplate.update({ where: { id }, data: { isDefault: true } });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "idCardTemplate.set_default",
        entityType: "IDCardTemplate",
        entityId: id,
        after: { name: row.name, category: row.category },
      });

      return row;
    });

    return NextResponse.json({ success: true, id: updated.id, category: updated.category });
  } catch (error) {
    return apiError(error);
  }
}
