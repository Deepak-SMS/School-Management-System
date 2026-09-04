import "server-only";
import { prisma } from "@/lib/db";
import { generateSchedule, type GeneratorResult, type PeriodDef, type PlacedUnit, type RequirementInput, type RoomDef, type TeacherDef } from "@/lib/timetable/generator";

export class TimetableNotFoundError extends Error {
  constructor() {
    super("Timetable not found.");
    this.name = "TimetableNotFoundError";
  }
}

/**
 * Loads a Timetable's real inputs from the DB, runs the pure generator, and
 * persists the result in one transaction. Regenerating only ever touches
 * source="auto" slots — manual placements are fed in as locked constraints
 * (see generator.ts's lockedPlacements) and are never overwritten.
 */
export async function runTimetableGeneration(schoolId: string, timetableId: string): Promise<GeneratorResult> {
  const timetable = await prisma.timetable.findFirst({
    where: { id: timetableId, schoolId },
    include: {
      timingSet: { include: { periods: { where: { kind: "teaching" }, orderBy: { sortOrder: "asc" } } } },
      classes: true,
    },
  });
  if (!timetable) throw new TimetableNotFoundError();

  const days: string[] = JSON.parse(timetable.workingDaysJson);
  const periods: PeriodDef[] = timetable.timingSet.periods.map((p) => ({ id: p.id, sortOrder: p.sortOrder }));

  // Resolve TimetableClass rows (sectionId null = every section of that class) into concrete sections.
  const explicitSectionIds = new Set(timetable.classes.filter((c) => c.sectionId).map((c) => c.sectionId as string));
  const classOnlyIds = timetable.classes.filter((c) => !c.sectionId).map((c) => c.classId);
  const classOnlySections = classOnlyIds.length
    ? await prisma.section.findMany({ where: { schoolId, classId: { in: classOnlyIds }, status: "active" }, select: { id: true } })
    : [];
  const sectionIds = new Set([...explicitSectionIds, ...classOnlySections.map((s) => s.id)]);

  const sectionList = await prisma.section.findMany({
    where: { id: { in: [...sectionIds] } },
    select: { id: true, classId: true },
  });
  if (sectionList.length === 0) {
    return { totalUnits: 0, placed: [], unplaced: [], softScore: 0 };
  }

  const classIds = [...new Set(sectionList.map((s) => s.classId))];
  const assignments = await prisma.subjectAssignment.findMany({
    where: { schoolId, academicYearId: timetable.academicYearId, classId: { in: classIds }, periodsPerWeek: { gt: 0 } },
  });

  const assignmentsByClass = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const list = assignmentsByClass.get(a.classId) ?? [];
    list.push(a);
    assignmentsByClass.set(a.classId, list);
  }

  // A section-specific assignment overrides a class-level (sectionId=null)
  // one for the same subject — same override semantics SubjectAssignment
  // already implies elsewhere.
  const requirements: RequirementInput[] = [];
  for (const section of sectionList) {
    const classAssignments = assignmentsByClass.get(section.classId) ?? [];
    const bySubject = new Map<string, typeof classAssignments>();
    for (const a of classAssignments) {
      const list = bySubject.get(a.subjectId) ?? [];
      list.push(a);
      bySubject.set(a.subjectId, list);
    }
    for (const [subjectId, rows] of bySubject) {
      const chosen = rows.find((r) => r.sectionId === section.id) ?? rows.find((r) => r.sectionId === null);
      if (!chosen) continue;
      requirements.push({
        id: `${chosen.id}:${section.id}`,
        sectionId: section.id,
        subjectId,
        teacherId: chosen.teacherId,
        periodsPerWeek: chosen.periodsPerWeek,
        preferDoublePeriod: chosen.preferDoublePeriod,
        preferredRoomId: chosen.preferredRoomId,
      });
    }
  }

  const rooms = await prisma.room.findMany({ where: { schoolId, status: "active" } });
  const roomDefs: RoomDef[] = rooms.map((r) => ({
    id: r.id,
    allowedSubjectIds: r.allowedSubjectIdsJson ? JSON.parse(r.allowedSubjectIdsJson) : null,
  }));

  const teacherIds = [...new Set(requirements.map((r) => r.teacherId).filter((id): id is string => Boolean(id)))];
  const [staffRows, unavailabilityRows] = teacherIds.length
    ? await Promise.all([
        prisma.staff.findMany({ where: { id: { in: teacherIds } }, select: { id: true, maxPeriodsPerDay: true, maxConsecutivePeriods: true } }),
        prisma.teacherUnavailability.findMany({ where: { staffId: { in: teacherIds } } }),
      ])
    : [[], []];

  const teachers = new Map<string, TeacherDef>();
  for (const s of staffRows) {
    teachers.set(s.id, {
      id: s.id,
      maxPeriodsPerDay: s.maxPeriodsPerDay,
      maxConsecutivePeriods: s.maxConsecutivePeriods,
      unavailableWholeDays: new Set(),
      unavailableSlots: new Set(),
    });
  }
  for (const u of unavailabilityRows) {
    const teacher = teachers.get(u.staffId);
    if (!teacher) continue;
    if (u.periodId === null) teacher.unavailableWholeDays.add(u.dayOfWeek);
    else teacher.unavailableSlots.add(`${u.dayOfWeek}|${u.periodId}`);
  }

  const manualSlots = await prisma.timetableSlot.findMany({ where: { timetableId, source: "manual" } });
  const lockedPlacements: PlacedUnit[] = manualSlots.map((s) => ({
    requirementId: `manual:${s.id}`,
    sectionId: s.sectionId,
    subjectId: s.subjectId,
    teacherId: s.teacherId,
    roomId: s.roomId,
    dayOfWeek: s.dayOfWeek,
    periodId: s.periodId,
  }));

  const result = generateSchedule({ days, periods, requirements, rooms: roomDefs, teachers, lockedPlacements });

  await prisma.$transaction(async (tx) => {
    await tx.timetableSlot.deleteMany({ where: { timetableId, source: "auto" } });
    if (result.placed.length > 0) {
      await tx.timetableSlot.createMany({
        data: result.placed.map((p) => ({
          schoolId,
          timetableId,
          sectionId: p.sectionId,
          dayOfWeek: p.dayOfWeek,
          periodId: p.periodId,
          subjectId: p.subjectId,
          teacherId: p.teacherId,
          roomId: p.roomId,
          source: "auto",
        })),
      });
    }
    await tx.timetable.update({ where: { id: timetableId }, data: { lastGenerationReportJson: JSON.stringify(result) } });
  });

  return result;
}
