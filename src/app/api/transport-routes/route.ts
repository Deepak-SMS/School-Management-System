import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportRouteInputSchema } from "@/lib/validation/transport-route";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("transportRoutes", "view");
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;

    const where: Prisma.TransportRouteWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(q && { OR: [{ name: { contains: q } }, { routeNumber: { contains: q } }, { destination: { contains: q } }] }),
    };

    const rows = await prisma.transportRoute.findMany({
      where,
      include: {
        _count: { select: { stops: true, studentTransports: true } },
        assignments: {
          where: { effectiveTo: null },
          include: { vehicle: { select: { id: true, vehicleNumber: true } }, driver: { select: { id: true, fullName: true, staff: { select: { fullName: true } } } } },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    const data = rows.map(({ assignments, _count, ...route }) => ({
      ...route,
      counts: { stops: _count.stops, students: _count.studentTransports },
      currentAssignment: assignments[0] ?? null,
    }));

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("transportRoutes", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(transportRouteInputSchema.parse(await request.json()));

    const route = await prisma.$transaction(async (tx) => {
      const created = await tx.transportRoute.create({ data: { schoolId, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportRoute.create",
        entityType: "TransportRoute",
        entityId: created.id,
        after: created,
      });
      return created;
    });

    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
