/** Shapes returned by the timetable API routes — dates arrive as ISO strings over JSON. */

export interface PeriodRecord {
  id: string;
  sortOrder: number;
  label: string;
  startTime: string;
  endTime: string;
  kind: string;
}

export interface TimingSetRecord {
  id: string;
  name: string;
  periods: PeriodRecord[];
}

export interface RoomRecord {
  id: string;
  name: string;
  campusId?: string | null;
  buildingName?: string | null;
  floor?: string | null;
  capacity?: number | null;
  roomType: string;
  allowedSubjectIds: string[] | null;
  status: string;
}

export interface TeacherUnavailabilityRecord {
  id: string;
  dayOfWeek: string;
  periodId: string | null;
}

export interface StaffAvailabilityRecord {
  id: string;
  fullName: string;
  maxPeriodsPerDay: number | null;
  maxConsecutivePeriods: number | null;
  unavailability: TeacherUnavailabilityRecord[];
}

export interface TimetableClassRecord {
  id: string;
  classId: string;
  sectionId: string | null;
  class: { id: string; name: string };
  section: { id: string; name: string } | null;
}

export interface TimetableSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  academicYear: { id: string; label: string };
  timingSet: { id: string; name: string };
  _count: { classes: number; slots: number };
}

export interface GenerationReport {
  totalUnits: number;
  placed: unknown[];
  unplaced: { requirementId: string; sectionId: string; subjectId: string; reason: string }[];
  softScore: number;
}

export interface TimetableDetail {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  workingDays: string[];
  academicYear: { id: string; label: string };
  timingSet: TimingSetRecord;
  classes: TimetableClassRecord[];
  lastGenerationReport: GenerationReport | null;
}

export interface TimetableSlotRecord {
  id: string;
  dayOfWeek: string;
  source: string;
  subject: { id: string; name: string; code: string };
  teacher: { id: string; fullName: string } | null;
  room: { id: string; name: string } | null;
  section: { id: string; name: string; classId: string; class?: { id: string; name: string } };
  period: { id: string; label: string; startTime: string; endTime: string; sortOrder: number };
  timetable?: { id: string; name: string };
}
