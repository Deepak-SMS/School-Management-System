import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";

/** Optional fee items from a structure this student is actively assigned to, that they don't already have a charge for — feeds the "opt into an optional fee" path of the add-charge modal. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("studentFees", "view");
    const { id: studentId } = await params;

    const assignments = await prisma.feeStructureAssignment.findMany({
      where: { studentId, schoolId, status: "active" },
      select: { feeStructureId: true },
    });
    if (assignments.length === 0) return NextResponse.json({ data: [] });

    const items = await prisma.feeStructureItem.findMany({
      where: { feeStructureId: { in: assignments.map((a) => a.feeStructureId) }, isOptional: true },
      include: {
        feeCategory: { select: { id: true, name: true, code: true } },
        feeStructure: { select: { id: true, name: true } },
      },
    });
    if (items.length === 0) return NextResponse.json({ data: [] });

    const existing = await prisma.studentFeeCharge.findMany({
      where: { studentId, feeStructureItemId: { in: items.map((i) => i.id) } },
      select: { feeStructureItemId: true },
    });
    const existingItemIds = new Set(existing.map((c) => c.feeStructureItemId));

    const data = items
      .filter((item) => !existingItemIds.has(item.id))
      .map((item) => ({
        id: item.id,
        amount: item.amount,
        frequency: item.frequency,
        feeCategory: item.feeCategory,
        feeStructure: item.feeStructure,
      }));

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
