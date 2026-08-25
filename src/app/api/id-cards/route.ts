import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import type { Prisma } from "@/generated/prisma/client";

/** List + lookup for Generated Cards, Card Management, and the admin Verification tool. `q` matches name/admission no./employee id/card number/QR code exactly or as a search term. */
export async function GET(request: NextRequest) {
  try {
  const { schoolId } = await requirePermission("idCards", "view");
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
  const status = params.get("status") ?? undefined;
  const cardType = params.get("cardType") ?? undefined;
  const q = params.get("q")?.trim();

  const where: Prisma.IDCardWhereInput = {
    schoolId,
    ...(status && { status }),
    ...(cardType === "student" && { studentId: { not: null } }),
    ...(cardType === "staff" && { staffId: { not: null } }),
    ...(q && {
      OR: [
        { cardNumber: { contains: q } },
        { student: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { admissionNumber: { contains: q } }] } },
        { staff: { OR: [{ fullName: { contains: q } }, { employeeId: { contains: q } }] } },
        { qrVerification: { code: { contains: q } } },
      ],
    }),
  };

  const [cards, total] = await Promise.all([
    prisma.iDCard.findMany({
      where,
      include: {
        template: { select: { id: true, name: true } },
        qrVerification: { select: { code: true } },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            admissionNumber: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
            academicYear: { select: { label: true } },
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
            employeeId: true,
            designation: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.iDCard.count({ where }),
  ]);

  return NextResponse.json({ data: cards, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}
