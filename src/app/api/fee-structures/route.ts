import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { feeStructureInputSchema } from "@/lib/validation/fee-structure";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { feeStructureInclude, shapeFeeStructures, shapeFeeStructure } from "@/lib/fee-structure-response";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("feeStructures", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const academicYearId = params.get("academicYearId") ?? undefined;
    const classId = params.get("classId") ?? undefined;
    const status = params.get("status") ?? undefined;

    const where: Prisma.FeeStructureWhereInput = {
      schoolId,
      ...(academicYearId && { academicYearId }),
      ...(classId && { classId }),
      ...(status && { status }),
      ...(q && { name: { contains: q } }),
    };

    const [rows, total] = await Promise.all([
      prisma.feeStructure.findMany({
        where,
        include: feeStructureInclude,
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.feeStructure.count({ where }),
    ]);

    return NextResponse.json({ data: await shapeFeeStructures(rows), total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("feeStructures", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(feeStructureInputSchema.parse(await request.json()));

    const academicYear = await prisma.academicYear.findFirst({ where: { id: input.academicYearId, schoolId } });
    if (!academicYear) return NextResponse.json({ error: "That academic year was not found." }, { status: 404 });

    if (input.classId) {
      const cls = await prisma.class.findFirst({ where: { id: input.classId, schoolId, academicYearId: input.academicYearId } });
      if (!cls) return NextResponse.json({ error: "That class was not found in the selected academic year." }, { status: 404 });
    }
    if (input.sectionId) {
      const section = await prisma.section.findFirst({ where: { id: input.sectionId, schoolId, classId: input.classId } });
      if (!section) return NextResponse.json({ error: "That section was not found in the selected class." }, { status: 404 });
    }
    if (input.studentCategoryId) {
      const category = await prisma.feeStudentCategory.findFirst({ where: { id: input.studentCategoryId, schoolId } });
      if (!category) return NextResponse.json({ error: "That student category was not found." }, { status: 404 });
    }

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

    const id = await prisma.$transaction(async (tx) => {
      const structure = await tx.feeStructure.create({
        data: {
          schoolId,
          academicYearId: input.academicYearId,
          name: input.name,
          description: input.description,
          classId: input.classId,
          sectionId: input.sectionId,
          studentCategoryId: input.studentCategoryId,
          createdById: user.id,
        },
      });

      for (const [index, item] of input.items.entries()) {
        await tx.feeStructureItem.create({
          data: {
            feeStructureId: structure.id,
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

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "feeStructure.create",
        entityType: "FeeStructure",
        entityId: structure.id,
        after: { name: structure.name, items: input.items.length },
      });

      return structure.id;
    });

    const created = await prisma.feeStructure.findUniqueOrThrow({ where: { id }, include: feeStructureInclude });
    return NextResponse.json(await shapeFeeStructure(created), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
