export interface SubjectAssignmentRecord {
  id: string;
  academicYear: { id: string; label: string };
  class: { id: string; name: string };
  section?: { id: string; name: string } | null;
  teacher?: { id: string; fullName: string } | null;
  createdAt: string;
  /** Timetable module — the generator's workload input, see src/lib/timetable/. */
  periodsPerWeek: number;
  preferDoublePeriod: boolean;
  preferredRoom?: { id: string; name: string } | null;
}

/** Shape returned by GET /api/subjects (and /api/subjects/[id]). */
export interface SubjectRecord {
  id: string;
  name: string;
  code: string;
  subjectType: string;
  description?: string | null;
  natureType: string;
  maxMarks?: number | null;
  passingMarks?: number | null;
  credits?: number | null;
  gradingSystem?: string | null;
  status: string;
  counts?: {
    classes: number;
    teachers: number;
  };
  /** Whether a hard delete would actually succeed right now — false if the subject is in a timetable, has attendance records, or is linked to library books, even with zero class assignments. From GET /api/subjects only. */
  deletable?: boolean;
  assignments?: SubjectAssignmentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface SubjectListResponse {
  data: SubjectRecord[];
  total: number;
  page: number;
  pageSize: number;
}
