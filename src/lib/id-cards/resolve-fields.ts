import { format } from "date-fns";
import type { School, Student, Class, Section, AcademicYear, Staff } from "@/generated/prisma/client";

/** Maps a student + their school/class/section/year into the `{{fieldKey}}` values a template's DesignElements reference. */
export function resolveStudentFields(
  student: Student & { class: Class; section: Section | null; academicYear: AcademicYear },
  school: School,
): Record<string, string> {
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
    "student.guardianName": student.guardianName ?? "",
    "student.guardianPhone": student.guardianPhone ?? "",
    "student.emergencyContact": student.emergencyContact ?? "",
    "student.address": [student.address, student.city, student.state, student.pinCode].filter(Boolean).join(", "),
    "student.busNumber": student.busNumber ?? "",
    "academicYear.label": student.academicYear.label,
  };
}

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
