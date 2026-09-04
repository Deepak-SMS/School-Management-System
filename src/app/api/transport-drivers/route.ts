import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportDriverInputSchema } from "@/lib/validation/transport-driver";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const STAFF_SELECT = { select: { id: true, fullName: true, mobileNumber: true, photoUrl: true, employmentStatus: true } };

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("transportDrivers", "view");
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;

    const where: Prisma.TransportDriverWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(q && {
        OR: [
          { fullName: { contains: q } },
          { phone: { contains: q } },
          { licenseNumber: { contains: q } },
          { staff: { fullName: { contains: q } } },
        ],
      }),
    };

    const data = await prisma.transportDriver.findMany({
      where,
      include: { staff: STAFF_SELECT },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("transportDrivers", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(transportDriverInputSchema.parse(await request.json()));
    const { licenseIssueDate, licenseExpiryDate, policeVerificationDate, medicalCertificateExpiryDate, ...rest } = input;

    if (rest.staffId) {
      const staff = await prisma.staff.findFirst({ where: { id: rest.staffId, schoolId } });
      if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }

    const driver = await prisma.$transaction(async (tx) => {
      const created = await tx.transportDriver.create({
        data: {
          schoolId,
          ...rest,
          licenseIssueDate: licenseIssueDate ? new Date(licenseIssueDate) : undefined,
          licenseExpiryDate: licenseExpiryDate ? new Date(licenseExpiryDate) : undefined,
          policeVerificationDate: policeVerificationDate ? new Date(policeVerificationDate) : undefined,
          medicalCertificateExpiryDate: medicalCertificateExpiryDate ? new Date(medicalCertificateExpiryDate) : undefined,
        },
        include: { staff: STAFF_SELECT },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportDriver.create",
        entityType: "TransportDriver",
        entityId: created.id,
        after: created,
      });
      return created;
    });

    return NextResponse.json(driver, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
