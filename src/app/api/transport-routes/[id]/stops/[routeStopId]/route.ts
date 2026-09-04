import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportRouteStopInputSchema } from "@/lib/validation/transport-route";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; routeStopId: string }> }) {
  try {
    const user = await requirePermission("transportRoutes", "edit");
    const { schoolId } = user;
    const { id: routeId, routeStopId } = await params;
    const input = cleanEmptyStrings(transportRouteStopInputSchema.pick({ pickupTime: true, dropTime: true }).partial().parse(await request.json()));

    const existing = await prisma.transportRouteStop.findFirst({ where: { id: routeStopId, routeId, route: { schoolId } } });
    if (!existing) return NextResponse.json({ error: "Route stop not found." }, { status: 404 });

    const updated = await prisma.transportRouteStop.update({ where: { id: routeStopId }, data: input, include: { stop: true } });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

/** Removes a stop from the route and closes the gap in sequence numbers left behind. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; routeStopId: string }> }) {
  try {
    const user = await requirePermission("transportRoutes", "edit");
    const { schoolId } = user;
    const { id: routeId, routeStopId } = await params;

    const existing = await prisma.transportRouteStop.findFirst({ where: { id: routeStopId, routeId, route: { schoolId } } });
    if (!existing) return NextResponse.json({ error: "Route stop not found." }, { status: 404 });

    const inUse = await prisma.studentTransport.count({
      where: { routeId, OR: [{ pickupStopId: existing.stopId }, { dropStopId: existing.stopId }] },
    });
    if (inUse > 0) {
      return NextResponse.json({ error: "A student uses this stop as their pickup/drop point on this route — reassign them first." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transportRouteStop.delete({ where: { id: routeStopId } });
      await tx.transportRouteStop.updateMany({
        where: { routeId, sequenceOrder: { gt: existing.sequenceOrder } },
        data: { sequenceOrder: { decrement: 1 } },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportRoute.removeStop",
        entityType: "TransportRoute",
        entityId: routeId,
        before: { stopId: existing.stopId, sequenceOrder: existing.sequenceOrder },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
