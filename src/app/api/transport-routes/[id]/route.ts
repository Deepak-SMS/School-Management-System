import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportRouteInputSchema } from "@/lib/validation/transport-route";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const DRIVER_SELECT = { select: { id: true, fullName: true, phone: true, staff: { select: { fullName: true, mobileNumber: true } } } };
const VEHICLE_SELECT = { select: { id: true, vehicleNumber: true, vehicleType: true, seatingCapacity: true } };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("transportRoutes", "view");
    const { id } = await params;

    const route = await prisma.transportRoute.findFirst({
      where: { id, schoolId },
      include: {
        stops: { include: { stop: true }, orderBy: { sequenceOrder: "asc" } },
        assignments: { include: { vehicle: VEHICLE_SELECT, driver: DRIVER_SELECT }, orderBy: { startDate: "desc" } },
        _count: { select: { studentTransports: true } },
      },
    });
    if (!route) return NextResponse.json({ error: "Route not found." }, { status: 404 });

    const { assignments, _count, ...rest } = route;
    return NextResponse.json({
      ...rest,
      counts: { students: _count.studentTransports },
      currentAssignment: assignments.find((a) => !a.effectiveTo) ?? null,
      assignmentHistory: assignments,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportRoutes", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(transportRouteInputSchema.partial().parse(await request.json()));

    const existing = await prisma.transportRoute.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Route not found." }, { status: 404 });

    const route = await prisma.$transaction(async (tx) => {
      const updated = await tx.transportRoute.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportRoute.update",
        entityType: "TransportRoute",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(route);
  } catch (error) {
    return apiError(error);
  }
}

/** Refuses to delete a route with active student enrollments — end those first. Stops and assignment history cascade. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportRoutes", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.transportRoute.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Route not found." }, { status: 404 });

    const students = await prisma.studentTransport.count({ where: { routeId: id } });
    if (students > 0) {
      return NextResponse.json({ error: "Students are enrolled on this route — end their transport enrollment first." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transportRoute.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportRoute.delete",
        entityType: "TransportRoute",
        entityId: id,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
