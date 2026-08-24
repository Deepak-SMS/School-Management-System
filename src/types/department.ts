export interface DepartmentHeadRef {
  id: string;
  fullName: string;
}

export interface DepartmentCampusRef {
  id: string;
  name: string;
}

/** Shape returned by GET /api/departments (and /api/departments/[id]). */
export interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
  departmentType: string;
  headStaffId?: string | null;
  head?: DepartmentHeadRef | null;
  description?: string | null;
  campusId?: string | null;
  campus?: DepartmentCampusRef | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  counts?: {
    employees: number;
    teachers: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentListResponse {
  data: DepartmentRecord[];
  total: number;
  page: number;
  pageSize: number;
}
