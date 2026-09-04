import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { feeStructureInclude, shapeFeeStructure } from "@/lib/fee-structure-response";

/**
 * Copies a structure's items and installments into a new draft — the "reuse
 * last year's fee structure" workflow. If the target is a different academic
 * year, the source's class/section (which are per-year rows, see Class in
 * schema.prisma) are re-matched by name in that year and left blank if no
 * match is found, and every installment due date shifts by the same gap as
 * the two years' start dates so a school doesn't have to re-enter a schedule
 * that just needs to move forward one year.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("feeStructures", "create");
    const { schoolId } = user;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const academicYearId = typeof body.academicYearId === "string" ? body.academicYearId.trim() : "";
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;

    if (!academicYearId) return NextResponse.json({ error: "Academic year is required." }, { status: 422 });

    const source = await prisma.feeStructure.findFirst({
      where: { id, schoolId },
      include: { items: { include: { installments: true } }, academicYear: true, class: true, section: true },
    });
    if (!source) return NextResponse.json({ error: "Fee structure not found." }, { status: 404 });

    const targetYear = await prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } });
    if (!targetYear) return NextResponse.json({ error: "That academic year was not found." }, { status: 404 });

    let targetClassId: string | null = null;
    let targetSectionId: string | null = null;
    if (source.classId && source.class) {
      const matchedClass = await prisma.class.findFirst({ where: { schoolId, academicYearId, name: source.class.name } });
      targetClassId = matchedClass?.id ?? null;
      if (targetClassId && source.sectionId && source.section) {
        const matchedSection = await prisma.section.findFirst({ where: { classId: targetClassId, name: source.section.name } });
        targetSectionId = matchedSection?.id ?? null;
      }
    }

    const dayOffsetMs = targetYear.startDate.getTime() - source.academicYear.startDate.getTime();

    const newId = await prisma.$transaction(async (tx) => {
      const structure = await tx.feeStructure.create({
        data: {
          schoolId,
          academicYearId,
          name: name ?? `${source.name} (Copy)`,
          description: source.description,
          classId: targetClassId,
          sectionId: targetSectionId,
          studentCategoryId: source.studentCategoryId,
          createdById: user.id,
        },
      });

      for (const item of source.items) {
        await tx.feeStructureItem.create({
          data: {
            feeStructureId: structure.id,
            feeCategoryId: item.feeCategoryId,
            amount: item.amount,
            frequency: item.frequency,
            isOptional: item.isOptional,
            lateFeeRuleId: item.lateFeeRuleId,
            sortOrder: item.sortOrder,
            installments: {
              create: item.installments.map((installment) => ({
                label: installment.label,
                dueDate: new Date(installment.dueDate.getTime() + dayOffsetMs),
                amount: installment.amount,
                sortOrder: installment.sortOrder,
              })),
            },
          },
        });
      }

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "feeStructure.duplicate",
        entityType: "FeeStructure",
        entityId: structure.id,
        after: { sourceId: source.id, academicYearId },
      });

      return structure.id;
    });

    const created = await prisma.feeStructure.findUniqueOrThrow({ where: { id: newId }, include: feeStructureInclude });
    return NextResponse.json(await shapeFeeStructure(created), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
