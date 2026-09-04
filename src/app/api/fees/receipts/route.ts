import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";

/**
 * The receipt register.
 *
 * Read-only by design: there is no POST here. A receipt comes into existence
 * only alongside the payment it belongs to, so the only way to create one is to
 * record a payment.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("receipts", "view");
    const params = request.nextUrl.searchParams;

    const q = params.get("q")?.trim();
    const studentId = params.get("studentId") ?? undefined;
    const status = params.get("status") ?? undefined;
    const from = params.get("from");
    const to = params.get("to");
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 25)));

    const where = {
      schoolId,
      ...(studentId && { studentId }),
      ...(status && { status }),
      ...((from || to) && {
        paidOn: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(`${to}T23:59:59.999Z`) }),
        },
      }),
      ...(q && {
        OR: [
          { receiptNumber: { contains: q } },
          { studentName: { contains: q } },
          { admissionNumber: { contains: q } },
          { referenceNo: { contains: q } },
        ],
      }),
    };

    const [data, total, totals] = await Promise.all([
      prisma.receipt.findMany({
        where,
        orderBy: { issuedOn: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.receipt.count({ where }),
      // Voided receipts are excluded from the collected figure, but stay listed.
      prisma.receipt.aggregate({ where: { ...where, status: "issued" }, _sum: { amountPaid: true } }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalCollected: totals._sum.amountPaid ?? 0,
    });
  } catch (error) {
    return apiError(error);
  }
}
