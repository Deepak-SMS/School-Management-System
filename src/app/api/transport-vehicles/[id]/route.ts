import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportVehicleInputSchema } from "@/lib/validation/transport-vehicle";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("transportVehicles", "view");
    const { id } = await params;

    const vehicle = await prisma.transportVehicle.findFirst({ where: { id, schoolId } });
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

    return NextResponse.json(vehicle);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportVehicles", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(transportVehicleInputSchema.partial().parse(await request.json()));

    const existing = await prisma.transportVehicle.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

    const vehicle = await prisma.$transaction(async (tx) => {
      const updated = await tx.transportVehicle.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportVehicle.update",
        entityType: "TransportVehicle",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(vehicle);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("transportVehicles", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.transportVehicle.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.transportVehicle.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportVehicle.delete",
        entityType: "TransportVehicle",
        entityId: id,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
