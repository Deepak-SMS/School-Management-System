import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transportStopInputSchema } from "@/lib/validation/transport-stop";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("transportStops", "view");
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;

    const where: Prisma.TransportStopWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(q && { OR: [{ name: { contains: q } }, { code: { contains: q } }, { landmark: { contains: q } }] }),
    };

    const data = await prisma.transportStop.findMany({ where, orderBy: { name: "asc" } });
    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("transportStops", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(transportStopInputSchema.parse(await request.json()));

    const stop = await prisma.$transaction(async (tx) => {
      const created = await tx.transportStop.create({ data: { schoolId, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "transportStop.create",
        entityType: "TransportStop",
        entityId: created.id,
        after: created,
      });
      return created;
    });

    return NextResponse.json(stop, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
