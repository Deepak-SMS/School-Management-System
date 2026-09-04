import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { examTypeInputSchema } from "@/lib/validation/exam-type";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("examTypes", "view");
    const { id } = await params;

    const type = await prisma.examType.findFirst({ where: { id, schoolId } });
    if (!type) return NextResponse.json({ error: "Exam type not found." }, { status: 404 });
    return NextResponse.json(type);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("examTypes", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(examTypeInputSchema.partial().parse(await request.json()));

    const existing = await prisma.examType.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Exam type not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.examType.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "examType.update",
        entityType: "ExamType",
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

/** Deactivates rather than deletes if any exam already references this type — never lose the ability to explain a past exam's type. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("examTypes", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.examType.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Exam type not found." }, { status: 404 });

    const inUse = await prisma.exam.count({ where: { examTypeId: id } });

    const result = await prisma.$transaction(async (tx) => {
      if (inUse > 0) {
        const row = await tx.examType.update({ where: { id }, data: { status: "inactive" } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "examType.deactivate",
          entityType: "ExamType",
          entityId: id,
          before: existing,
          after: row,
        });
        return { deactivated: true, examsUsingType: inUse };
      }
      await tx.examType.delete({ where: { id } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "examType.delete", entityType: "ExamType", entityId: id, before: existing });
      return { deactivated: false, examsUsingType: 0 };
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
