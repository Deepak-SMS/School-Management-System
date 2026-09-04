import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportRouteAssignmentInputSchema } from "@/lib/validation/transport-route";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const DRIVER_SELECT = { select: { id: true, fullName: true, phone: true, staff: { select: { fullName: true, mobileNumber: true } } } };
const VEHICLE_SELECT = { select: { id: true, vehicleNumber: true, vehicleType: true, seatingCapacity: true } };

/**
 * Assigns (or reassigns) the vehicle + driver for a route. Never overwrites the
 * current assignment row — closes it (`effectiveTo`) and writes a new one, so
 * "who was driving Route 4 in March" stays answerable. See TRANSPORT-ROADMAP.md §2.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportRoutes", "edit");
    const { schoolId } = user;
    const { id: routeId } = await params;
    const input = cleanEmptyStrings(transportRouteAssignmentInputSchema.parse(await request.json()));

    const [route, vehicle, driver] = await Promise.all([
      prisma.transportRoute.findFirst({ where: { id: routeId, schoolId } }),
      prisma.transportVehicle.findFirst({ where: { id: input.vehicleId, schoolId } }),
      prisma.transportDriver.findFirst({ where: { id: input.driverId, schoolId } }),
    ]);
    if (!route) return NextResponse.json({ error: "Route not found." }, { status: 404 });
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    if (!driver) return NextResponse.json({ error: "Driver not found." }, { status: 404 });

    const [vehicleBusy, driverBusy] = await Promise.all([
      prisma.transportRouteAssignment.findFirst({ where: { vehicleId: input.vehicleId, effectiveTo: null, routeId: { not: routeId } } }),
      prisma.transportRouteAssignment.findFirst({ where: { driverId: input.driverId, effectiveTo: null, routeId: { not: routeId } } }),
    ]);
    if (vehicleBusy) return NextResponse.json({ error: "This vehicle is already assigned to another route." }, { status: 409 });
    if (driverBusy) return NextResponse.json({ error: "This driver is already assigned to another route." }, { status: 409 });

    const startDate = new Date(input.startDate);

    const assignment = await prisma.$transaction(async (tx) => {
      await tx.transportRouteAssignment.updateMany({
        where: { routeId, effectiveTo: null },
        data: { effectiveTo: startDate },
      });

      const created = await tx.transportRouteAssignment.create({
        data: { schoolId, routeId, vehicleId: input.vehicleId, driverId: input.driverId, startDate, note: input.note, createdById: user.id },
        include: { vehicle: VEHICLE_SELECT, driver: DRIVER_SELECT },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportRoute.assign",
        entityType: "TransportRoute",
        entityId: routeId,
        after: { vehicleId: input.vehicleId, driverId: input.driverId, startDate: input.startDate },
      });

      return created;
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
