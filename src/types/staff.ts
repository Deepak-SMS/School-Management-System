/** Shape returned by GET /api/staff (and /api/staff/[id]) — dates arrive as ISO strings over JSON. */
export interface StaffRecord {
  id: string;
  employeeId: string;
  fullName: string;
  photoUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  designation: string;
  department?: string | null;
  category: string;
  mobileNumber: string;
  email?: string | null;
  emergencyContact?: string | null;
  address?: string | null;
  joiningDate?: string | null;
  employeeType?: string | null;
  employmentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffListResponse {
  data: StaffRecord[];
  total: number;
  page: number;
  pageSize: number;
}
