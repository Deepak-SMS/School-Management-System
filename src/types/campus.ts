export interface CampusHeadRef {
  id: string;
  fullName: string;
}

/** Shape returned by GET /api/campuses (and /api/campuses/[id]) — dates arrive as ISO strings over JSON. */
export interface CampusRecord {
  id: string;
  name: string;
  code: string;
  campusType: string;
  headStaffId?: string | null;
  head?: CampusHeadRef | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pinCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  studentCapacity?: number | null;
  staffCapacity?: number | null;
  status: string;
  counts?: {
    classes: number;
    sections: number;
    students: number;
    departments: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CampusListResponse {
  data: CampusRecord[];
  total: number;
  page: number;
  pageSize: number;
}
