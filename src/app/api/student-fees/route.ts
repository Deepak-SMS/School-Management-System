import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { summarizeStudentFees } from "@/lib/student-fee-ledger";
import type { Prisma } from "@/generated/prisma/client";

/**
 * One summary row per student with a fee account — the list the Student Fees
 * screen opens on. Filtering/pagination happens in memory after loading every
 * matching student's charges, which is fine at this app's scale (~1,000
 * students per school); see the counts-via-Promise.all pattern used elsewhere
 * (e.g. /api/employee-types) for the same tradeoff.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("studentFees", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const classId = params.get("classId") ?? undefined;
    const sectionId = params.get("sectionId") ?? undefined;
    const balance = params.get("balance") ?? undefined;

    const where: Prisma.StudentWhereInput = {
      schoolId,
      // Only students with at least one charge have a fee account to show.
      feeCharges: { some: {} },
      ...(classId && { classId }),
      ...(sectionId && { sectionId }),
      ...(q && {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { admissionNumber: { contains: q } },
        ],
      }),
    };

    const students = await prisma.student.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        photoUrl: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        feeCharges: {
          select: {
            amount: true,
            dueDate: true,
            status: true,
            adjustments: { select: { type: true, amount: true } },
            allocations: { select: { amount: true, payment: { select: { status: true } } } },
          },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    let rows = students.map(({ feeCharges, ...student }) => ({
      student,
      summary: summarizeStudentFees(feeCharges),
    }));

    if (balance === "outstanding") rows = rows.filter((r) => r.summary.totalPending > 0);
    else if (balance === "overdue") rows = rows.filter((r) => r.summary.totalOverdue > 0);
    else if (balance === "cleared") rows = rows.filter((r) => r.summary.totalPending <= 0);

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const data = rows.slice(start, start + pageSize);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}
