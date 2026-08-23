export interface Campus {
  id: string;
  name: string;
  city: string;
  isPrimary?: boolean;
}

export interface AcademicYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}

export interface School {
  id: string;
  name: string;
  shortName: string;
  logoInitials: string;
  campuses: Campus[];
  academicYears: AcademicYear[];
}
