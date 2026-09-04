export interface ExamAcademicYearRef {
  id: string;
  label: string;
}

export interface ExamTypeRef {
  id: string;
  name: string;
  examCategory: string;
}

export interface ExamClassEntry {
  id?: string;
  classId: string;
  className: string;
  sectionId?: string | null;
  sectionName?: string | null;
}

/** Shape returned by GET /api/exams (and /api/exams/[id]). */
export interface ExamRecord {
  id: string;
  name: string;
  code: string;
  term?: string | null;
  startDate: string;
  endDate: string;
  resultDate?: string | null;
  resultType: string;
  status: string;
  academicYear: ExamAcademicYearRef;
  examType: ExamTypeRef;
  classes: ExamClassEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamListResponse {
  data: ExamRecord[];
  total: number;
  page: number;
  pageSize: number;
}
