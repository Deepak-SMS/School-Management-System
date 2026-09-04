import { format } from "date-fns";
import type { School, Student, Class, Section, AcademicYear, Staff, Designation, Department } from "@/generated/prisma/client";

/**
 * Maps a student + school/class/section/year into the `{{fieldKey}}` values a
 * certificate template's design elements reference. Mirrors
 * `src/lib/id-cards/resolve-fields.ts`, extended with the admission/previous-
 * school fields certificates need that ID cards never did.
 */
export function resolveStudentCertificateFields(
  student: Student & {
    class: Class;
    section: Section | null;
    academicYear: AcademicYear;
    guardians?: { guardian: { fullName: string; mobile: string | null }; isPrimary: boolean }[];
  },
  school: School,
  certificateNumber: string,
): Record<string, string> {
  const primaryGuardian = student.guardians?.find((g) => g.isPrimary)?.guardian ?? student.guardians?.[0]?.guardian;

  return {
    "school.name": school.name,
    "school.address": [school.address, school.city, school.state].filter(Boolean).join(", "),
    "school.phone": school.phone ?? "",
    "school.email": school.email ?? "",
    "school.website": school.website ?? "",
    "school.principalName": school.principalName ?? "",
    "school.udisePlusCode": school.udisePlusCode ?? "",
    "school.affiliationBoard": school.affiliationBoard ?? "",
    "school.boardAffiliationNumber": school.boardAffiliationNumber ?? "",
    "school.logoUrl": school.logoUrl ?? "",
    "school.principalSignatureUrl": school.principalSignatureUrl ?? "",
    "school.schoolSealUrl": school.schoolSealUrl ?? "",
    "certificate.number": certificateNumber,
    "certificate.issueDate": format(new Date(), "dd MMM yyyy"),
    "student.name": [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
    "student.admissionNumber": student.admissionNumber,
    "student.class": student.class.name,
    "student.section": student.section?.name ?? "",
    "student.rollNumber": student.rollNumber ?? "",
    "student.dateOfBirth": student.dateOfBirth ? format(student.dateOfBirth, "dd MMM yyyy") : "",
    "student.gender": student.gender ?? "",
    "student.bloodGroup": student.bloodGroup ?? "",
    "student.guardianName": primaryGuardian?.fullName ?? "",
    "student.guardianPhone": primaryGuardian?.mobile ?? "",
    "student.address": [student.address, student.city, student.state, student.pinCode].filter(Boolean).join(", "),
    "student.admissionDate": student.admissionDate ? format(student.admissionDate, "dd MMM yyyy") : "",
    "student.previousSchool": student.previousSchool ?? "",
    "student.previousClass": student.previousClass ?? "",
    "academicYear.label": student.academicYear.label,
  };
}

export function resolveStaffCertificateFields(
  staff: Staff & { department: Department | null; designation: Designation | null },
  school: School,
  certificateNumber: string,
): Record<string, string> {
  return {
    "school.name": school.name,
    "school.address": [school.address, school.city, school.state].filter(Boolean).join(", "),
    "school.phone": school.phone ?? "",
    "school.email": school.email ?? "",
    "school.website": school.website ?? "",
    "school.principalName": school.principalName ?? "",
    "school.logoUrl": school.logoUrl ?? "",
    "school.principalSignatureUrl": school.principalSignatureUrl ?? "",
    "school.schoolSealUrl": school.schoolSealUrl ?? "",
    "certificate.number": certificateNumber,
    "certificate.issueDate": format(new Date(), "dd MMM yyyy"),
    "staff.name": staff.fullName,
    "staff.employeeId": staff.employeeId,
    "staff.designation": staff.designation?.name ?? "",
    "staff.department": staff.department?.name ?? "",
    "staff.joiningDate": staff.joiningDate ? format(staff.joiningDate, "dd MMM yyyy") : "",
    "staff.dateOfBirth": staff.dateOfBirth ? format(staff.dateOfBirth, "dd MMM yyyy") : "",
    "staff.mobileNumber": staff.mobileNumber,
    "staff.address": [staff.address, staff.city, staff.state, staff.pinCode].filter(Boolean).join(", "),
  };
}

/** Field codes offered in the designer/properties panel, grouped for display. */
export const CERTIFICATE_FIELD_GROUPS: { label: string; fields: { key: string; label: string }[] }[] = [
  {
    label: "School",
    fields: [
      { key: "school.name", label: "School name" },
      { key: "school.address", label: "School address" },
      { key: "school.principalName", label: "Principal name" },
      { key: "school.udisePlusCode", label: "UDISE+ code" },
      { key: "school.affiliationBoard", label: "Affiliation board" },
      { key: "school.logoUrl", label: "School logo (image)" },
      { key: "school.principalSignatureUrl", label: "Principal signature (image)" },
      { key: "school.schoolSealUrl", label: "School seal (image)" },
    ],
  },
  {
    label: "Certificate",
    fields: [
      { key: "certificate.number", label: "Certificate number" },
      { key: "certificate.issueDate", label: "Issue date" },
    ],
  },
  {
    label: "Student",
    fields: [
      { key: "student.name", label: "Student name" },
      { key: "student.admissionNumber", label: "Admission number" },
      { key: "student.class", label: "Class" },
      { key: "student.section", label: "Section" },
      { key: "student.rollNumber", label: "Roll number" },
      { key: "student.dateOfBirth", label: "Date of birth" },
      { key: "student.gender", label: "Gender" },
      { key: "student.guardianName", label: "Guardian name" },
      { key: "student.address", label: "Address" },
      { key: "student.admissionDate", label: "Date of admission" },
      { key: "student.previousSchool", label: "Previous school" },
      { key: "academicYear.label", label: "Academic year" },
    ],
  },
  {
    label: "Staff",
    fields: [
      { key: "staff.name", label: "Employee name" },
      { key: "staff.employeeId", label: "Employee ID" },
      { key: "staff.designation", label: "Designation" },
      { key: "staff.department", label: "Department" },
      { key: "staff.joiningDate", label: "Joining date" },
      { key: "staff.dateOfBirth", label: "Date of birth" },
      { key: "staff.address", label: "Address" },
    ],
  },
];
