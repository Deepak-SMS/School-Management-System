import { format } from "date-fns";
import type { School, Student, Class, Section, AcademicYear, Staff } from "@/generated/prisma/client";

/**
 * Maps a student + their school/class/section/year into the `{{fieldKey}}` values
 * a template's DesignElements reference.
 *
 * Guardian details now live in their own table, so the caller passes the primary
 * guardian alongside the student. Cards keep printing the same `student.guardian*`
 * keys, so existing templates need no changes.
 */
export function resolveStudentFields(
  student: Student & {
    class: Class;
    section: Section | null;
    academicYear: AcademicYear;
    guardians?: { guardian: { fullName: string; mobile: string | null }; isPrimary: boolean }[];
  },
  school: School,
): Record<string, string> {
  // The flagged primary guardian, else whoever is listed first.
  const primaryGuardian = student.guardians?.find((g) => g.isPrimary)?.guardian ?? student.guardians?.[0]?.guardian;

  return {
    "school.name": school.name,
    "school.address": [school.address, school.city, school.state].filter(Boolean).join(", "),
    "school.phone": school.phone ?? "",
    "school.email": school.email ?? "",
    "school.website": school.website ?? "",
    "school.principalName": school.principalName ?? "",
    "student.name": [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
    "student.admissionNumber": student.admissionNumber,
    "student.class": student.class.name,
    "student.section": student.section?.name ?? "",
    "student.rollNumber": student.rollNumber ?? "",
    "student.dateOfBirth": student.dateOfBirth ? format(student.dateOfBirth, "dd MMM yyyy") : "",
    "student.bloodGroup": student.bloodGroup ?? "",
    "student.house": student.house ?? "",
    "student.guardianName": primaryGuardian?.fullName ?? "",
    "student.guardianPhone": primaryGuardian?.mobile ?? "",
    "student.emergencyContact": student.emergencyContact ?? "",
    "student.address": [student.address, student.city, student.state, student.pinCode].filter(Boolean).join(", "),
    "student.busNumber": student.busNumber ?? "",
    "academicYear.label": student.academicYear.label,
  };
}

/** Field codes offered in the designer's "Bind to data" picker, grouped for display — mirrors CERTIFICATE_FIELD_GROUPS. Keys match resolveStudentFields/resolveStaffFields and SAMPLE_CARD_DATA exactly. */
export const ID_CARD_FIELD_GROUPS: { label: string; fields: { key: string; label: string }[] }[] = [
  {
    label: "School",
    fields: [
      { key: "school.name", label: "School name" },
      { key: "school.address", label: "School address" },
      { key: "school.phone", label: "School phone" },
      { key: "school.email", label: "School email" },
      { key: "school.website", label: "School website" },
      { key: "school.principalName", label: "Principal name" },
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
      { key: "student.bloodGroup", label: "Blood group" },
      { key: "student.house", label: "House" },
      { key: "student.guardianName", label: "Guardian name" },
      { key: "student.guardianPhone", label: "Guardian phone" },
      { key: "student.emergencyContact", label: "Emergency contact" },
      { key: "student.address", label: "Address" },
      { key: "student.busNumber", label: "Bus number" },
    ],
  },
  {
    label: "Staff",
    fields: [
      { key: "staff.name", label: "Employee name" },
      { key: "staff.employeeId", label: "Employee ID" },
      { key: "staff.designation", label: "Designation" },
      { key: "staff.department", label: "Department" },
      { key: "staff.bloodGroup", label: "Blood group" },
      { key: "staff.mobileNumber", label: "Mobile number" },
    ],
  },
  {
    label: "Academic",
    fields: [{ key: "academicYear.label", label: "Academic year" }],
  },
];

export function resolveStaffFields(
  staff: Staff & { department: { name: string } | null; designation: { name: string } | null },
  school: School,
): Record<string, string> {
  return {
    "school.name": school.name,
    "school.address": [school.address, school.city, school.state].filter(Boolean).join(", "),
    "school.phone": school.phone ?? "",
    "school.email": school.email ?? "",
    "school.website": school.website ?? "",
    "school.principalName": school.principalName ?? "",
    "staff.name": staff.fullName,
    "staff.employeeId": staff.employeeId,
    "staff.designation": staff.designation?.name ?? "",
    "staff.department": staff.department?.name ?? "",
    "staff.bloodGroup": staff.bloodGroup ?? "",
    "staff.mobileNumber": staff.mobileNumber,
  };
}
