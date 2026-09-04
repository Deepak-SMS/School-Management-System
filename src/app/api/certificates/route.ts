import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** The centralized "Generated Certificates" register — searchable by student/staff name, admission/employee number, certificate number, type, and status. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("certificates", "view");
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;
    const certificateTypeId = params.get("certificateTypeId") ?? undefined;

    const where: Prisma.CertificateWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(certificateTypeId && { certificateTypeId }),
      ...(q && {
        OR: [
          { certificateNumber: { contains: q } },
          { student: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { admissionNumber: { contains: q } }] } },
          { staff: { OR: [{ fullName: { contains: q } }, { employeeId: { contains: q } }] } },
        ],
      }),
    };

    const rows = await prisma.certificate.findMany({
      where,
      include: {
        certificateType: { select: { name: true, category: true } },
        template: { select: { name: true } },
        student: { select: { firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } }, section: { select: { name: true } } } },
        staff: { select: { fullName: true, employeeId: true, designation: { select: { name: true } } } },
        generatedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ data: rows, total: rows.length });
  } catch (error) {
    return apiError(error);
  }
}
