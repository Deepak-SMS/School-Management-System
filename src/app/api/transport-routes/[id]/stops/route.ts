import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportRouteStopInputSchema } from "@/lib/validation/transport-route";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** Appends one stop to the end of a route's ordered list. Reordering after the fact is a separate endpoint. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportRoutes", "edit");
    const { schoolId } = user;
    const { id: routeId } = await params;
    const input = cleanEmptyStrings(transportRouteStopInputSchema.parse(await request.json()));

    const [route, stop, existingLink] = await Promise.all([
      prisma.transportRoute.findFirst({ where: { id: routeId, schoolId } }),
      prisma.transportStop.findFirst({ where: { id: input.stopId, schoolId } }),
      prisma.transportRouteStop.findUnique({ where: { routeId_stopId: { routeId, stopId: input.stopId } } }),
    ]);
    if (!route) return NextResponse.json({ error: "Route not found." }, { status: 404 });
    if (!stop) return NextResponse.json({ error: "Stop not found." }, { status: 404 });
    if (existingLink) return NextResponse.json({ error: "This stop is already on the route." }, { status: 409 });

    const routeStop = await prisma.$transaction(async (tx) => {
      const maxOrder = await tx.transportRouteStop.aggregate({ where: { routeId }, _max: { sequenceOrder: true } });
      const created = await tx.transportRouteStop.create({
        data: { routeId, stopId: input.stopId, sequenceOrder: (maxOrder._max.sequenceOrder ?? 0) + 1, pickupTime: input.pickupTime, dropTime: input.dropTime },
        include: { stop: true },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportRoute.addStop",
        entityType: "TransportRoute",
        entityId: routeId,
        after: { stopId: input.stopId, sequenceOrder: created.sequenceOrder },
      });
      return created;
    });

    return NextResponse.json(routeStop, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
