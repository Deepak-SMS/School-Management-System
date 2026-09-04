import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { studentTransportInputSchema } from "@/lib/validation/student-transport";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const STUDENT_SELECT = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    admissionNumber: true,
    photoUrl: true,
    class: { select: { id: true, name: true } },
    section: { select: { id: true, name: true } },
  },
};
const ROUTE_SELECT = { select: { id: true, name: true, routeNumber: true } };
const STOP_SELECT = { select: { id: true, name: true } };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("transportStudents", "view");
    const { id } = await params;

    const enrollment = await prisma.studentTransport.findFirst({
      where: { id, schoolId },
      include: { student: STUDENT_SELECT, route: ROUTE_SELECT, pickupStop: STOP_SELECT, dropStop: STOP_SELECT },
    });
    if (!enrollment) return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });

    return NextResponse.json(enrollment);
  } catch (error) {
    return apiError(error);
  }
}

/** Also the "end transport" action: set `status: "inactive"` with an `endDate`. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportStudents", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(studentTransportInputSchema.partial().parse(await request.json()));
    const { startDate, endDate, ...rest } = input;

    const existing = await prisma.studentTransport.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });

    const enrollment = await prisma.$transaction(async (tx) => {
      const updated = await tx.studentTransport.update({
        where: { id },
        data: {
          ...rest,
          ...(startDate !== undefined && { startDate: new Date(startDate) }),
          ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        },
        include: { student: STUDENT_SELECT, route: ROUTE_SELECT, pickupStop: STOP_SELECT, dropStop: STOP_SELECT },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "studentTransport.update",
        entityType: "StudentTransport",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(enrollment);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportStudents", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.studentTransport.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.studentTransport.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "studentTransport.delete",
        entityType: "StudentTransport",
        entityId: id,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
