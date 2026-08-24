export interface ClassAcademicYearRef {
  id: string;
  label: string;
}

export interface ClassCampusRef {
  id: string;
  name: string;
}

export interface ClassTeacherRef {
  id: string;
  fullName: string;
}

/** Shape returned by GET /api/classes (and /api/classes/[id]). */
export interface ClassRecord {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  capacity?: number | null;
  classTeacherId?: string | null;
  classTeacher?: ClassTeacherRef | null;
  gradingSystem?: string | null;
  status: string;
  academicYear: ClassAcademicYearRef;
  campus: ClassCampusRef;
  counts?: {
    sections: number;
    students: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ClassListResponse {
  data: ClassRecord[];
  total: number;
  page: number;
  pageSize: number;
}
