export interface SectionClassRef {
  id: string;
  name: string;
}

export interface SectionTeacherRef {
  id: string;
  fullName: string;
}

/** Shape returned by GET /api/sections (and /api/sections/[id]). */
export interface SectionRecord {
  id: string;
  name: string;
  code: string;
  room?: string | null;
  classTeacherId?: string | null;
  classTeacher?: SectionTeacherRef | null;
  capacity?: number | null;
  status: string;
  class: SectionClassRef;
  academicYear: { id: string; label: string };
  campus: { id: string; name: string };
  counts?: {
    students: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SectionListResponse {
  data: SectionRecord[];
  total: number;
  page: number;
  pageSize: number;
}
