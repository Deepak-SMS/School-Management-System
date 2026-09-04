import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const entryInclude = {
  staff: { select: { id: true, employeeId: true, fullName: true, designation: { select: { name: true } }, department: { select: { name: true } } } },
  structure: { select: { id: true, name: true } },
  slip: { select: { id: true, slipNumber: true, pdfFileId: true } },
} satisfies Prisma.PayrollEntryInclude;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("payroll", "view");
    const { id } = await params;

    const period = await prisma.payrollPeriod.findFirst({
      where: { id, schoolId },
      include: { entries: { include: entryInclude, orderBy: { staff: { employeeId: "asc" } } } },
    });
    if (!period) return NextResponse.json({ error: "Payroll period not found." }, { status: 404 });

    const { entries, ...rest } = period;
    const data = entries.map((e) => ({
      ...e,
      earnings: JSON.parse(e.earningsJson),
      deductions: JSON.parse(e.deductionsJson),
      slipPdfUrl: e.slip?.pdfFileId ? `/api/files/${e.slip.pdfFileId}` : null,
    }));

    return NextResponse.json({ ...rest, entryCount: data.length, entries: data });
  } catch (error) {
    return apiError(error);
  }
}
