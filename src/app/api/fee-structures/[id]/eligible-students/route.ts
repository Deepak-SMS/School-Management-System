import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { countEligibleStudents } from "@/lib/fee-eligibility";

/** Preview count shown before publishing, so an admin can see the blast radius first. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("feeStructures", "view");
    const { id } = await params;

    const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Fee structure not found." }, { status: 404 });

    const count = await countEligibleStudents({
      schoolId,
      academicYearId: existing.academicYearId,
      classId: existing.classId,
      sectionId: existing.sectionId,
      studentCategoryId: existing.studentCategoryId,
    });

    return NextResponse.json({ count });
  } catch (error) {
    return apiError(error);
  }
}
