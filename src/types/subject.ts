export interface SubjectAssignmentRecord {
  id: string;
  academicYear: { id: string; label: string };
  class: { id: string; name: string };
  section?: { id: string; name: string } | null;
  teacher?: { id: string; fullName: string } | null;
  createdAt: string;
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
