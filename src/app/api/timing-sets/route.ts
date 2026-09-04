import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { timingSetInputSchema } from "@/lib/validation/timetable";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const { schoolId } = await requirePermission("timetable", "view");
    const timingSets = await prisma.timingSet.findMany({
      where: { schoolId },
      include: { periods: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: timingSets });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("timetable", "create");
    const body = await request.json();
    const input = timingSetInputSchema.parse(body);

    const timingSet = await prisma.$transaction(async (tx) => {
      const created = await tx.timingSet.create({ data: { schoolId, name: input.name } });
      await tx.period.createMany({
        data: input.periods.map((p) => ({
          schoolId,
          timingSetId: created.id,
          sortOrder: p.sortOrder,
          label: p.label,
          startTime: p.startTime,
          endTime: p.endTime,
          kind: p.kind,
        })),
      });
      return tx.timingSet.findUniqueOrThrow({ where: { id: created.id }, include: { periods: { orderBy: { sortOrder: "asc" } } } });
    });

    return NextResponse.json(timingSet, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
