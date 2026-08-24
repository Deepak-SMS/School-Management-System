/** Shape returned by GET /api/academic-years (and /api/academic-years/[id]) — dates arrive as ISO strings over JSON. */
export interface AcademicYearRecord {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  admissionStartDate?: string | null;
  admissionEndDate?: string | null;
  promotionDate?: string | null;
  resultPublicationDate?: string | null;
  status: string;
  counts?: {
    students: number;
    classes: number;
    sections: number;
    subjects: number;
    teachers: number;
  };
  createdAt: string;
}

export interface AcademicYearListResponse {
  data: AcademicYearRecord[];
  total: number;
  page: number;
  pageSize: number;
}
