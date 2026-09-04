import "server-only";
import { prisma } from "@/lib/db";
import type { TimetableDetail } from "@/types/timetable";

/** Shared by GET /api/timetables/[id] and the timetable detail page (server component). */
export async function loadTimetableDetail(id: string, schoolId: string): Promise<TimetableDetail | null> {
  const timetable = await prisma.timetable.findFirst({
    where: { id, schoolId },
    include: {
      academicYear: { select: { id: true, label: true } },
      timingSet: { include: { periods: { orderBy: { sortOrder: "asc" } } } },
      classes: { include: { class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } } },
    },
  });
  if (!timetable) return null;

  return {
    id: timetable.id,
    name: timetable.name,
    startDate: timetable.startDate.toISOString(),
    endDate: timetable.endDate.toISOString(),
    status: timetable.status,
    workingDays: JSON.parse(timetable.workingDaysJson),
    academicYear: timetable.academicYear,
    timingSet: timetable.timingSet,
    classes: timetable.classes,
    lastGenerationReport: timetable.lastGenerationReportJson ? JSON.parse(timetable.lastGenerationReportJson) : null,
  };
}
