import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { feeStudentCategoryInputSchema } from "@/lib/validation/fee-student-category";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("feeStudentCategories", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(feeStudentCategoryInputSchema.partial().parse(await request.json()));

    const existing = await prisma.feeStudentCategory.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Student category not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.feeStudentCategory.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "feeStudentCategory.update",
        entityType: "FeeStudentCategory",
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

/** Deactivates rather than deletes when students or fee structures still reference it. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("feeStudentCategories", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.feeStudentCategory.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Student category not found." }, { status: 404 });

    const [studentsInUse, structuresInUse] = await Promise.all([
      prisma.student.count({ where: { schoolId, feeCategoryId: id } }),
      prisma.feeStructure.count({ where: { schoolId, studentCategoryId: id } }),
    ]);
    const inUse = studentsInUse + structuresInUse;

    const result = await prisma.$transaction(async (tx) => {
      if (inUse > 0) {
        const row = await tx.feeStudentCategory.update({ where: { id }, data: { status: "inactive" } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "feeStudentCategory.deactivate",
          entityType: "FeeStudentCategory",
          entityId: id,
          before: existing,
          after: row,
        });
        return { deactivated: true, students: studentsInUse };
      }

      await tx.feeStudentCategory.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "feeStudentCategory.delete",
        entityType: "FeeStudentCategory",
        entityId: id,
        before: existing,
      });
      return { deactivated: false, students: 0 };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
