import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { studentFeeChargeInputSchema } from "@/lib/validation/student-fee";
import { chargeKey, chargeInputsForItem } from "@/lib/student-fee-charges";
import { studentFeeChargeInclude, shapeStudentFeeCharge } from "@/lib/student-fee-response";

/**
 * Adds one or more charges to a student's account — either opting them into an
 * existing fee structure item (usually an optional one, e.g. transport) or
 * recording a fully ad-hoc charge with no backing item. See
 * src/lib/validation/student-fee.ts for which fields each path needs.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("studentFees", "create");
    const { schoolId } = user;
    const { id: studentId } = await params;
    const input = cleanEmptyStrings(studentFeeChargeInputSchema.parse(await request.json()));

    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    let created;

    if (input.feeStructureItemId) {
      const item = await prisma.feeStructureItem.findFirst({
        where: { id: input.feeStructureItemId, feeStructure: { schoolId } },
        include: { installments: true, feeCategory: { select: { name: true } } },
      });
      if (!item) return NextResponse.json({ error: "That fee item was not found." }, { status: 404 });

      const assignment = await prisma.feeStructureAssignment.findFirst({
        where: { feeStructureId: item.feeStructureId, studentId, status: "active" },
      });
      if (!assignment) {
        return NextResponse.json({ error: "This student isn't assigned to that fee structure." }, { status: 422 });
      }

      const candidates = chargeInputsForItem(schoolId, studentId, item);
      const dueDates = item.installments.length === 0 ? [null] : item.installments.map((i) => i.dueDate);
      const existing = await prisma.studentFeeCharge.findMany({
        where: { studentId, feeStructureItemId: item.id },
        select: { dueDate: true },
      });
      const existingKeys = new Set(existing.map((c) => chargeKey(studentId, item.id, c.dueDate)));
      const toCreate = candidates.filter((_, index) => !existingKeys.has(chargeKey(studentId, item.id, dueDates[index])));

      if (toCreate.length === 0) {
        return NextResponse.json({ error: "This student already has every charge for that fee item." }, { status: 409 });
      }

      created = await prisma.$transaction(async (tx) => {
        await tx.studentFeeCharge.createMany({ data: toCreate });
        const rows = await tx.studentFeeCharge.findMany({
          where: { studentId, feeStructureItemId: item.id },
          include: studentFeeChargeInclude,
          orderBy: { dueDate: "asc" },
        });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "studentFeeCharge.optIn",
          entityType: "Student",
          entityId: studentId,
          after: { feeStructureItemId: item.id, created: toCreate.length },
        });
        return rows;
      });
    } else {
      // Ad-hoc charge — the schema's refine already guarantees feeCategoryId, label and amount are all present here.
      const feeCategoryId = input.feeCategoryId!;
      const category = await prisma.feeCategory.findFirst({ where: { id: feeCategoryId, schoolId } });
      if (!category) return NextResponse.json({ error: "That fee category was not found." }, { status: 404 });

      created = await prisma.$transaction(async (tx) => {
        const charge = await tx.studentFeeCharge.create({
          data: {
            schoolId,
            studentId,
            feeCategoryId,
            label: input.label!,
            amount: input.amount!,
            dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
            isManual: true,
            note: input.note,
            createdById: user.id,
          },
          include: studentFeeChargeInclude,
        });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "studentFeeCharge.create",
          entityType: "StudentFeeCharge",
          entityId: charge.id,
          after: { label: charge.label, amount: charge.amount },
        });
        return [charge];
      });
    }

    return NextResponse.json({ data: created.map(shapeStudentFeeCharge) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
