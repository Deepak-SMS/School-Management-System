import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { syncFeeStructureAssignments, generateStudentFeeCharges } from "@/lib/fee-eligibility";
import { feeStructureInclude, shapeFeeStructure } from "@/lib/fee-structure-response";

/**
 * Moves a fee structure live and computes which students it applies to.
 * Safe to call again on an already-published structure — it re-syncs
 * assignments (e.g. after new admissions add matching students) rather than
 * erroring, so "Publish" doubles as a "Refresh assignments" action.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("feeStructures", "activate");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId }, include: { items: true } });
    if (!existing) return NextResponse.json({ error: "Fee structure not found." }, { status: 404 });
    if (existing.items.length === 0) {
      return NextResponse.json({ error: "Add at least one fee item before publishing." }, { status: 422 });
    }

    const sync = await prisma.$transaction(async (tx) => {
      const result = await syncFeeStructureAssignments(tx, id, {
        schoolId,
        academicYearId: existing.academicYearId,
        classId: existing.classId,
        sectionId: existing.sectionId,
        studentCategoryId: existing.studentCategoryId,
      });

      const chargesGenerated = await generateStudentFeeCharges(tx, id, result.assignedStudentIds);

      await tx.feeStructure.update({
        where: { id },
        data: { status: "published", publishedAt: existing.publishedAt ?? new Date(), publishedById: user.id },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "feeStructure.publish",
        entityType: "FeeStructure",
        entityId: id,
        after: { ...result, chargesGenerated },
      });

      return { newlyAssigned: result.newlyAssigned, totalAssigned: result.totalAssigned, chargesGenerated };
    });

    const updated = await prisma.feeStructure.findUniqueOrThrow({ where: { id }, include: feeStructureInclude });
    return NextResponse.json({ structure: await shapeFeeStructure(updated), ...sync });
  } catch (error) {
    return apiError(error);
  }
}
