/** Shapes returned by the HR APIs. Dates arrive as ISO strings over JSON. */

export interface NamedRef {
  id: string;
  name: string;
}

export interface EmployeeRecord {
  id: string;
  employeeId: string;
  fullName: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  photoUrl?: string | null;
  photoFileId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;

  mobileNumber: string;
  alternateNumber?: string | null;
  email?: string | null;
  officialEmail?: string | null;
  address?: string | null;
  permanentAddress?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pinCode?: string | null;
  emergencyName?: string | null;
  emergencyRelation?: string | null;
  emergencyContact?: string | null;
  emergencyAddress?: string | null;

  category: string;
  designation: string;
  designationId?: string | null;
  departmentId?: string | null;
  department?: NamedRef | null;
  campusId?: string | null;
  campus?: NamedRef | null;
  employeeType?: string | null;
  employeeTypeId?: string | null;
  reportingManagerId?: string | null;
  reportingManager?: { id: string; fullName: string; employeeId?: string } | null;
  workLocation?: string | null;
  joiningDate?: string | null;
  confirmationDate?: string | null;
  probationEndDate?: string | null;
  probationMonths?: number | null;
  employmentStatus: string;

  /** Present only when the caller holds `employeeSalary:view` — otherwise stripped server-side. */
  panNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankAccountHolder?: string | null;
  pfNumber?: string | null;
  esicNumber?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface EmployeeDetail extends EmployeeRecord {
  qrVerification?: { code: string } | null;
  educations?: EmployeeEducation[];
  experiences?: EmployeeExperience[];
}

export interface EmployeeEducation {
  id: string;
  degree: string;
  institution?: string | null;
  board?: string | null;
  passingYear?: number | null;
  percentage?: number | null;
  uploadedFileId?: string | null;
}

export interface EmployeeExperience {
  id: string;
  organization: string;
  designation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  uploadedFileId?: string | null;
}

export interface EmployeeDocument {
  id: string;
  staffId: string;
  documentType: string;
  title?: string | null;
  uploadedFileId: string;
  status: string;
  expiryDate?: string | null;
  version: number;
  uploadedById?: string | null;
  verifiedById?: string | null;
  verifiedAt?: string | null;
  rejectionNote?: string | null;
  createdAt: string;
  uploadedFile?: { id: string; originalName?: string | null; mimeType?: string | null; sizeBytes?: number | null };
}

export interface EmployeeActivity {
  id: string;
  type: string;
  description: string;
  actorId?: string | null;
  occurredAt: string;
}

export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EmployeeListParams {
  q?: string;
  category?: string;
  employmentStatus?: string;
  departmentId?: string;
  designationId?: string;
  employeeTypeId?: string;
  campusId?: string;
  gender?: string;
  reportingManagerId?: string;
  joinedFrom?: string;
  joinedTo?: string;
  employed?: boolean;
  probation?: boolean;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface HrLookups {
  departments: { id: string; name: string; code: string }[];
  designations: { id: string; name: string; code: string; departmentId: string | null; level: number }[];
  employeeTypes: { id: string; name: string; code: string; isPaid: boolean }[];
  campuses: { id: string; name: string; code: string }[];
  managers: { id: string; fullName: string; employeeId: string }[];
}

export interface DesignationRecord {
  id: string;
  name: string;
  code: string;
  departmentId?: string | null;
  department?: NamedRef | null;
  level: number;
  description?: string | null;
  status: string;
  counts?: { employees: number };
}

export interface EmployeeTypeRecord {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  sortOrder: number;
  status: string;
  counts?: { employees: number };
}
