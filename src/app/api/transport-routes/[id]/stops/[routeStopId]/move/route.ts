import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportRouteStopMoveSchema } from "@/lib/validation/transport-route";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";

/** Swaps this stop's position with its immediate neighbor — the up/down arrows in the route editor. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; routeStopId: string }> }) {
  try {
    const { schoolId } = await requirePermission("transportRoutes", "edit");
    const { id: routeId, routeStopId } = await params;
    const { direction } = transportRouteStopMoveSchema.parse(await request.json());

    const current = await prisma.transportRouteStop.findFirst({ where: { id: routeStopId, routeId, route: { schoolId } } });
    if (!current) return NextResponse.json({ error: "Route stop not found." }, { status: 404 });

    const neighbor = await prisma.transportRouteStop.findFirst({
      where: {
        routeId,
        sequenceOrder: direction === "up" ? { lt: current.sequenceOrder } : { gt: current.sequenceOrder },
      },
      orderBy: { sequenceOrder: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbor) return NextResponse.json({ error: `Already at the ${direction === "up" ? "top" : "bottom"} of the route.` }, { status: 409 });

    await prisma.$transaction([
      prisma.transportRouteStop.update({ where: { id: current.id }, data: { sequenceOrder: neighbor.sequenceOrder } }),
      prisma.transportRouteStop.update({ where: { id: neighbor.id }, data: { sequenceOrder: current.sequenceOrder } }),
    ]);

    const stops = await prisma.transportRouteStop.findMany({ where: { routeId }, include: { stop: true }, orderBy: { sequenceOrder: "asc" } });
    return NextResponse.json({ data: stops });
  } catch (error) {
    return apiError(error);
  }
}
