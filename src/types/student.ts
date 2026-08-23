export interface StudentClassRef {
  id: string;
  name: string;
}

export interface StudentSectionRef {
  id: string;
  name: string;
}

export interface StudentAcademicYearRef {
  id: string;
  label: string;
}

/** Shape returned by GET /api/students (and /api/students/[id]) — dates arrive as ISO strings over JSON. */
export interface StudentRecord {
  id: string;
  admissionNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  photoUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  rollNumber?: string | null;
  house?: string | null;
  status: string;
  guardianName?: string | null;
  guardianPhone?: string | null;
  emergencyContact?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pinCode?: string | null;
  busNumber?: string | null;
  route?: string | null;
  pickupPoint?: string | null;
  class: StudentClassRef;
  section?: StudentSectionRef | null;
  academicYear: StudentAcademicYearRef;
  createdAt: string;
  updatedAt: string;
}

export interface StudentListResponse {
  data: StudentRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SchoolStructure {
  classes: (StudentClassRef & { sections: StudentSectionRef[] })[];
  academicYears: (StudentAcademicYearRef & { isCurrent: boolean })[];
}
