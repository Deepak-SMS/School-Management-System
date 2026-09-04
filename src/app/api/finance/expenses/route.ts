import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { expenseInputSchema } from "@/lib/validation/expense";
import { createExpense, expenseTotals, ExpenseError } from "@/lib/finance/expense-service";
import { apiError } from "@/lib/api-error";

/** The expense register, with the totals the header shows. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("expenses", "view");
    const params = request.nextUrl.searchParams;

    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;
    const categoryId = params.get("categoryId") ?? undefined;
    const from = params.get("from");
    const to = params.get("to");
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 25)));

    const where = {
      schoolId,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...((from || to) && {
        expenseDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to + "T23:59:59.999Z") }),
        },
      }),
      ...(q && {
        OR: [
          { expenseNumber: { contains: q } },
          { title: { contains: q } },
          { payeeName: { contains: q } },
          { referenceNo: { contains: q } },
        ],
      }),
    };

    const [data, total, totals] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, code: true } },
          attachments: { select: { id: true } },
        },
        orderBy: { expenseDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expense.count({ where }),
      expenseTotals(schoolId, where),
    ]);

    return NextResponse.json({ data, total, page, pageSize, totals });
  } catch (error) {
    return apiError(error);
  }
}

/** Raises a new expense. It always starts as a draft — see createExpense. */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("expenses", "create");
    const input = expenseInputSchema.parse(await request.json());

    const expense = await createExpense(user, input);
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof ExpenseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
