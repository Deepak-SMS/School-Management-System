import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { timetableSlotInputSchema } from "@/lib/validation/timetable";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { assertSlotIsValid } from "@/lib/timetable/validate-slot";
import { apiError } from "@/lib/api-error";

/**
 * Moves or reassigns one slot. Always flips `source` to "manual" — once a
 * person edits a cell, a later regenerate must never silently overwrite it
 * again (see src/lib/timetable/generate-timetable.ts's lockedPlacements).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; slotId: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "edit");
    const { id: timetableId, slotId } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(timetableSlotInputSchema.parse(body));

    const existing = await prisma.timetableSlot.findFirst({ where: { id: slotId, timetableId, schoolId } });
    if (!existing) return NextResponse.json({ error: "Slot not found." }, { status: 404 });

    const validation = await assertSlotIsValid({
      timetableId,
      slotId,
      sectionId: input.sectionId,
      dayOfWeek: input.dayOfWeek,
      periodId: input.periodId,
      teacherId: input.teacherId ?? null,
      roomId: input.roomId ?? null,
    });
    if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 409 });

    const slot = await prisma.timetableSlot.update({
      where: { id: slotId },
      data: {
        sectionId: input.sectionId,
        dayOfWeek: input.dayOfWeek,
        periodId: input.periodId,
        subjectId: input.subjectId,
        teacherId: input.teacherId ?? null,
        roomId: input.roomId ?? null,
        source: "manual",
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
        room: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(slot);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; slotId: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "edit");
    const { id: timetableId, slotId } = await params;
    const existing = await prisma.timetableSlot.findFirst({ where: { id: slotId, timetableId, schoolId } });
    if (!existing) return NextResponse.json({ error: "Slot not found." }, { status: 404 });

    await prisma.timetableSlot.delete({ where: { id: slotId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
