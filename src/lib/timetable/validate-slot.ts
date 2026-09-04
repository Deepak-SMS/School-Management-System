import "server-only";
import { prisma } from "@/lib/db";

export interface SlotEditInput {
  timetableId: string;
  /** Omit when creating a brand-new manual slot. */
  slotId?: string;
  sectionId: string;
  dayOfWeek: string;
  periodId: string;
  teacherId: string | null;
  roomId: string | null;
}

export interface SlotValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * The same hard-constraint checks the generator enforces during construction
 * (src/lib/timetable/generator.ts), re-run against the live DB for a manual
 * edit — so a manual move can never create a clash the generator wouldn't
 * have allowed in the first place.
 */
export async function assertSlotIsValid(input: SlotEditInput): Promise<SlotValidationResult> {
  const timetable = await prisma.timetable.findUnique({
    where: { id: input.timetableId },
    select: { workingDaysJson: true, timingSetId: true },
  });
  if (!timetable) return { ok: false, reason: "Timetable not found." };

  const workingDays: string[] = JSON.parse(timetable.workingDaysJson);
  if (!workingDays.includes(input.dayOfWeek)) {
    return { ok: false, reason: "This timetable doesn't run on that day." };
  }

  const period = await prisma.period.findUnique({ where: { id: input.periodId } });
  if (!period || period.timingSetId !== timetable.timingSetId || period.kind !== "teaching") {
    return { ok: false, reason: "That isn't a teaching period on this timetable." };
  }

  const excludeSelf = input.slotId ? { id: { not: input.slotId } } : {};

  const [sectionClash, teacherClash, roomClash] = await Promise.all([
    prisma.timetableSlot.findFirst({
      where: { timetableId: input.timetableId, sectionId: input.sectionId, dayOfWeek: input.dayOfWeek, periodId: input.periodId, ...excludeSelf },
    }),
    input.teacherId
      ? prisma.timetableSlot.findFirst({
          where: { timetableId: input.timetableId, teacherId: input.teacherId, dayOfWeek: input.dayOfWeek, periodId: input.periodId, ...excludeSelf },
        })
      : Promise.resolve(null),
    input.roomId
      ? prisma.timetableSlot.findFirst({
          where: { timetableId: input.timetableId, roomId: input.roomId, dayOfWeek: input.dayOfWeek, periodId: input.periodId, ...excludeSelf },
        })
      : Promise.resolve(null),
  ]);

  if (sectionClash) return { ok: false, reason: "This section already has a subject in that period." };
  if (teacherClash) return { ok: false, reason: "That teacher is already teaching another class at this time." };
  if (roomClash) return { ok: false, reason: "That room is already in use at this time." };

  if (input.teacherId) {
    const unavailable = await prisma.teacherUnavailability.findFirst({
      where: { staffId: input.teacherId, dayOfWeek: input.dayOfWeek, OR: [{ periodId: null }, { periodId: input.periodId }] },
    });
    if (unavailable) return { ok: false, reason: "That teacher is marked unavailable at this time." };
  }

  return { ok: true };
}
