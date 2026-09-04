import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { expenseCategoryInputSchema } from "@/lib/validation/expense";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants/expenses";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Heads of expenditure.
 *
 * A school with none yet gets the standard set seeded on first read, so the
 * module is usable straight away instead of presenting an empty dropdown and no
 * way past it. Seeding once is safe: it only fires when the school has zero.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("expenseCategories", "view");
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

    const existing = await prisma.expenseCategory.count({ where: { schoolId } });
    if (existing === 0) {
      await prisma.expenseCategory.createMany({
        data: DEFAULT_EXPENSE_CATEGORIES.map((c, index) => ({
          schoolId,
          name: c.name,
          code: c.code,
          description: c.description,
          sortOrder: index,
          status: "active",
        })),
      });
    }

    const data = await prisma.expenseCategory.findMany({
      where: { schoolId, ...(includeInactive ? {} : { status: "active" }) },
      include: { _count: { select: { expenses: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("expenseCategories", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(expenseCategoryInputSchema.parse(await request.json()));

    const category = await prisma.$transaction(async (tx) => {
      const row = await tx.expenseCategory.create({
        data: {
          schoolId,
          name: input.name,
          code: input.code.toUpperCase(),
          description: input.description,
          approvalThreshold: input.approvalThreshold,
          // No default from the schema under a partial — set explicitly.
          status: input.status ?? "active",
          sortOrder: input.sortOrder ?? 0,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "finance.expenseCategory.create",
        entityType: "ExpenseCategory",
        entityId: row.id,
        after: { name: row.name, code: row.code },
      });

      return row;
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
