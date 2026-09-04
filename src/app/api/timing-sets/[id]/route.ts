import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { timingSetInputSchema } from "@/lib/validation/timetable";
import { apiError } from "@/lib/api-error";

/** Replaces the name and the full periods list in one transaction — timing sets are small, hand-edited configuration, not a large collection worth a partial-update API. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "edit");
    const { id } = await params;
    const body = await request.json();
    const input = timingSetInputSchema.parse(body);

    const existing = await prisma.timingSet.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Timing set not found." }, { status: 404 });

    const timingSet = await prisma.$transaction(async (tx) => {
      await tx.timingSet.update({ where: { id }, data: { name: input.name } });
      await tx.period.deleteMany({ where: { timingSetId: id } });
      await tx.period.createMany({
        data: input.periods.map((p) => ({
          schoolId,
          timingSetId: id,
          sortOrder: p.sortOrder,
          label: p.label,
          startTime: p.startTime,
          endTime: p.endTime,
          kind: p.kind,
        })),
      });
      return tx.timingSet.findUniqueOrThrow({ where: { id }, include: { periods: { orderBy: { sortOrder: "asc" } } } });
    });

    return NextResponse.json(timingSet);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "delete");
    const { id } = await params;
    const existing = await prisma.timingSet.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Timing set not found." }, { status: 404 });

    const usedByTimetables = await prisma.timetable.count({ where: { timingSetId: id } });
    if (usedByTimetables > 0) {
      return NextResponse.json({ error: "This timing set is used by a timetable and can't be deleted." }, { status: 409 });
    }

    await prisma.timingSet.delete({ where: { id } }); // periods cascade via onDelete: Cascade
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
