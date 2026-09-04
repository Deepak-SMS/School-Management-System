import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportStopInputSchema } from "@/lib/validation/transport-stop";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("transportStops", "view");
    const { id } = await params;

    const stop = await prisma.transportStop.findFirst({ where: { id, schoolId } });
    if (!stop) return NextResponse.json({ error: "Stop not found." }, { status: 404 });

    return NextResponse.json(stop);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportStops", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(transportStopInputSchema.partial().parse(await request.json()));

    const existing = await prisma.transportStop.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Stop not found." }, { status: 404 });

    const stop = await prisma.$transaction(async (tx) => {
      const updated = await tx.transportStop.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportStop.update",
        entityType: "TransportStop",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(stop);
  } catch (error) {
    return apiError(error);
  }
}

/** Refuses to delete a stop still on a route's ordered list or in use as a pickup/drop point — reassign first. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportStops", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.transportStop.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Stop not found." }, { status: 404 });

    const [onRoutes, pickups, drops] = await Promise.all([
      prisma.transportRouteStop.count({ where: { stopId: id } }),
      prisma.studentTransport.count({ where: { pickupStopId: id } }),
      prisma.studentTransport.count({ where: { dropStopId: id } }),
    ]);
    const inUse = onRoutes + pickups + drops;
    if (inUse > 0) {
      return NextResponse.json({ error: "This stop is still used by a route or a student's pickup/drop point — remove those first." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transportStop.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportStop.delete",
        entityType: "TransportStop",
        entityId: id,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
