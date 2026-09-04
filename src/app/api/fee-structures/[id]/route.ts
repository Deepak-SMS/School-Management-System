import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { feeStructureUpdateSchema } from "@/lib/validation/fee-structure";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { feeStructureInclude, shapeFeeStructure } from "@/lib/fee-structure-response";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("feeStructures", "view");
    const { id } = await params;

    const row = await prisma.feeStructure.findFirst({ where: { id, schoolId }, include: feeStructureInclude });
    if (!row) return NextResponse.json({ error: "Fee structure not found." }, { status: 404 });

    return NextResponse.json(await shapeFeeStructure(row));
  } catch (error) {
    return apiError(error);
  }
}

/** Only a `draft` structure may change its targeting or fee items — once published, an admin duplicates it to make changes rather than editing billed students' fees in place. Name/description remain editable at any status. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("feeStructures", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(feeStructureUpdateSchema.parse(await request.json()));

    const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Fee structure not found." }, { status: 404 });

    const changesTargeting =
      input.items !== undefined ||
      (input.academicYearId !== undefined && input.academicYearId !== existing.academicYearId) ||
      (input.classId !== undefined && input.classId !== (existing.classId ?? undefined)) ||
      (input.sectionId !== undefined && input.sectionId !== (existing.sectionId ?? undefined)) ||
      (input.studentCategoryId !== undefined && input.studentCategoryId !== (existing.studentCategoryId ?? undefined));

    if (existing.status !== "draft" && changesTargeting) {
      return NextResponse.json(
        { error: "Only a draft fee structure can change its fee items or targeting. Duplicate this one to make changes." },
        { status: 409 },
      );
    }

    const academicYearId = input.academicYearId ?? existing.academicYearId;
    if (input.classId) {
      const cls = await prisma.class.findFirst({ where: { id: input.classId, schoolId, academicYearId } });
      if (!cls) return NextResponse.json({ error: "That class was not found in the selected academic year." }, { status: 404 });
    }
    if (input.sectionId) {
      const classId = input.classId ?? existing.classId ?? undefined;
      const section = await prisma.section.findFirst({ where: { id: input.sectionId, schoolId, classId } });
      if (!section) return NextResponse.json({ error: "That section was not found in the selected class." }, { status: 404 });
    }
    if (input.studentCategoryId) {
      const category = await prisma.feeStudentCategory.findFirst({ where: { id: input.studentCategoryId, schoolId } });
      if (!category) return NextResponse.json({ error: "That student category was not found." }, { status: 404 });
    }
    if (input.items) {
      const categoryIds = [...new Set(input.items.map((i) => i.feeCategoryId))];
      const categories = await prisma.feeCategory.findMany({ where: { id: { in: categoryIds }, schoolId } });
      if (categories.length !== categoryIds.length) {
        return NextResponse.json({ error: "One or more fee categories were not found." }, { status: 404 });
      }
      const lateFeeRuleIds = [...new Set(input.items.map((i) => i.lateFeeRuleId).filter((v): v is string => Boolean(v)))];
      if (lateFeeRuleIds.length > 0) {
        const rules = await prisma.lateFeeRule.findMany({ where: { id: { in: lateFeeRuleIds }, schoolId } });
        if (rules.length !== lateFeeRuleIds.length) {
          return NextResponse.json({ error: "One or more late fee rules were not found." }, { status: 404 });
        }
      }
    }

    const { items, ...structureFields } = input;

    await prisma.$transaction(async (tx) => {
      await tx.feeStructure.update({ where: { id }, data: structureFields });

      if (items) {
        await tx.feeStructureItem.deleteMany({ where: { feeStructureId: id } });
        for (const [index, item] of items.entries()) {
          await tx.feeStructureItem.create({
            data: {
              feeStructureId: id,
              feeCategoryId: item.feeCategoryId,
              amount: item.amount,
              frequency: item.frequency,
              isOptional: item.isOptional,
              lateFeeRuleId: item.lateFeeRuleId || undefined,
              sortOrder: index,
              installments: {
                create: item.installments.map((installment, installmentIndex) => ({
                  label: installment.label,
                  dueDate: new Date(installment.dueDate),
                  amount: installment.amount,
                  sortOrder: installmentIndex,
                })),
              },
            },
          });
        }
      }

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "feeStructure.update",
        entityType: "FeeStructure",
        entityId: id,
        before: existing,
        after: structureFields,
      });
    });

    const updated = await prisma.feeStructure.findUniqueOrThrow({ where: { id }, include: feeStructureInclude });
    return NextResponse.json(await shapeFeeStructure(updated));
  } catch (error) {
    return apiError(error);
  }
}

/** Only a draft can be deleted outright — a structure that was ever published keeps its record; archive it instead. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("feeStructures", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Fee structure not found." }, { status: 404 });

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only a draft fee structure can be deleted. Archive a published one instead — it keeps the record for history." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.feeStructure.delete({ where: { id } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "feeStructure.delete", entityType: "FeeStructure", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
