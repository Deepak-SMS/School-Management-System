import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("payroll", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const periodId = params.get("periodId") ?? undefined;

    const where: Prisma.SalarySlipWhereInput = {
      schoolId,
      ...(periodId && { entry: { periodId } }),
      ...(q && {
        OR: [
          { slipNumber: { contains: q } },
          { entry: { staff: { fullName: { contains: q } } } },
          { entry: { staff: { employeeId: { contains: q } } } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.salarySlip.findMany({
        where,
        include: {
          entry: {
            include: {
              staff: { select: { id: true, fullName: true, employeeId: true, designation: { select: { name: true } } } },
              period: { select: { id: true, year: true, month: true } },
            },
          },
        },
        orderBy: { generatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salarySlip.count({ where }),
    ]);

    const data = rows.map((s) => ({
      id: s.id,
      slipNumber: s.slipNumber,
      generatedAt: s.generatedAt,
      pdfUrl: s.pdfFileId ? `/api/files/${s.pdfFileId}` : null,
      staff: s.entry.staff,
      period: s.entry.period,
      netSalary: s.entry.netSalary,
    }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}
