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

/** A guardian as returned with a student — the person plus what's true of that pairing. */
export interface StudentGuardianRef {
  id: string;
  relationship: string;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  isAuthorizedPickup: boolean;
  canReceiveAcademic: boolean;
  canReceiveFee: boolean;
  guardian: {
    id: string;
    fullName: string;
    mobile?: string | null;
    alternateMobile?: string | null;
    email?: string | null;
    occupation?: string | null;
    /** Employer. */
    organization?: string | null;
    /** Highest qualification. */
    education?: string | null;
    address?: string | null;
  };
}

/** Shape returned by GET /api/students (and /api/students/[id]) — dates arrive as ISO strings over JSON. */
export interface StudentRecord {
  id: string;
  admissionNumber: string;
  enrollmentNumber?: string | null;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  photoUrl?: string | null;
  photoFileId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  nationality?: string | null;
  motherTongue?: string | null;
  /** Optional and only collected where a school must report it. */
  category?: string | null;
  religion?: string | null;
  govtIdRef?: string | null;

  // Admission
  previousSchool?: string | null;
  previousClass?: string | null;
  admissionDate?: string | null;
  admissionType?: string | null;

  // Academic placement
  rollNumber?: string | null;
  house?: string | null;
  stream?: string | null;
  medium?: string | null;
  promotionStatus?: string | null;
  status: string;

  // Address
  address?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  pinCode?: string | null;
  sameAsCurrent?: boolean | null;
  permanentAddress?: string | null;
  permanentLine2?: string | null;
  permanentCity?: string | null;
  permanentDistrict?: string | null;
  permanentState?: string | null;
  permanentCountry?: string | null;
  permanentPinCode?: string | null;

  // Contact
  primaryMobile?: string | null;
  secondaryMobile?: string | null;
  studentEmail?: string | null;
  parentEmail?: string | null;
  whatsappNumber?: string | null;

  // Emergency
  emergencyName?: string | null;
  emergencyRelation?: string | null;
  emergencyContact?: string | null;
  emergencyAltPhone?: string | null;
  emergencyAddress?: string | null;

  // Transport
  busNumber?: string | null;
  route?: string | null;
  pickupPoint?: string | null;

  class: StudentClassRef;
  section?: StudentSectionRef | null;
  academicYear: StudentAcademicYearRef;
  guardians?: StudentGuardianRef[];
  createdAt: string;
  updatedAt: string;
}

/** A document filed for a student — admission papers and academic records. */
export interface StudentDocumentRecord {
  id: string;
  studentId: string;
  documentType: string;
  category: string;
  title?: string | null;
  uploadedFileId: string;
  status: string;
  version: number;
  issuedOn?: string | null;
  academicYearId?: string | null;
  note?: string | null;
  createdAt: string;
  uploadedFile?: { id: string; originalName?: string | null; mimeType?: string | null; sizeBytes?: number | null };
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
