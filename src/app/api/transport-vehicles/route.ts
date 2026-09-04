import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportVehicleInputSchema } from "@/lib/validation/transport-vehicle";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("transportVehicles", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;
    const vehicleType = params.get("vehicleType") ?? undefined;

    const where: Prisma.TransportVehicleWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(vehicleType && { vehicleType }),
      ...(q && {
        OR: [{ vehicleNumber: { contains: q } }, { make: { contains: q } }, { modelName: { contains: q } }],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.transportVehicle.findMany({
        where,
        orderBy: { vehicleNumber: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.transportVehicle.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("transportVehicles", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(transportVehicleInputSchema.parse(await request.json()));

    const vehicle = await prisma.$transaction(async (tx) => {
      const created = await tx.transportVehicle.create({ data: { schoolId, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportVehicle.create",
        entityType: "TransportVehicle",
        entityId: created.id,
        after: created,
      });
      return created;
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
