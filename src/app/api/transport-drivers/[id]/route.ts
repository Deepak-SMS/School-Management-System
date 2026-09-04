import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportDriverBaseSchema } from "@/lib/validation/transport-driver";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const STAFF_SELECT = { select: { id: true, fullName: true, mobileNumber: true, photoUrl: true, employmentStatus: true } };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("transportDrivers", "view");
    const { id } = await params;

    const driver = await prisma.transportDriver.findFirst({ where: { id, schoolId }, include: { staff: STAFF_SELECT } });
    if (!driver) return NextResponse.json({ error: "Driver not found." }, { status: 404 });

    return NextResponse.json(driver);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportDrivers", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(transportDriverBaseSchema.partial().parse(await request.json()));
    const { licenseIssueDate, licenseExpiryDate, policeVerificationDate, medicalCertificateExpiryDate, ...rest } = input;

    const existing = await prisma.transportDriver.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Driver not found." }, { status: 404 });

    if (rest.staffId) {
      const staff = await prisma.staff.findFirst({ where: { id: rest.staffId, schoolId } });
      if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }

    const driver = await prisma.$transaction(async (tx) => {
      const updated = await tx.transportDriver.update({
        where: { id },
        data: {
          ...rest,
          ...(licenseIssueDate !== undefined && { licenseIssueDate: licenseIssueDate ? new Date(licenseIssueDate) : null }),
          ...(licenseExpiryDate !== undefined && { licenseExpiryDate: licenseExpiryDate ? new Date(licenseExpiryDate) : null }),
          ...(policeVerificationDate !== undefined && { policeVerificationDate: policeVerificationDate ? new Date(policeVerificationDate) : null }),
          ...(medicalCertificateExpiryDate !== undefined && {
            medicalCertificateExpiryDate: medicalCertificateExpiryDate ? new Date(medicalCertificateExpiryDate) : null,
          }),
        },
        include: { staff: STAFF_SELECT },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportDriver.update",
        entityType: "TransportDriver",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(driver);
  } catch (error) {
    return apiError(error);
  }
}

/** Refuses to delete a driver currently holding an open route assignment — end the assignment first. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportDrivers", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.transportDriver.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Driver not found." }, { status: 404 });

    const activeAssignments = await prisma.transportRouteAssignment.count({ where: { driverId: id, effectiveTo: null } });
    if (activeAssignments > 0) {
      return NextResponse.json({ error: "This driver is currently assigned to a route — end that assignment first." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transportDriver.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportDriver.delete",
        entityType: "TransportDriver",
        entityId: id,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
