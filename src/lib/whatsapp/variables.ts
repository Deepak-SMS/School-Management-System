import type { School } from "@/generated/prisma/client";

/**
 * Built-in ERP variable resolution for WhatsApp templates. Reuses the
 * {{field.key}} dot-path naming convention already established by
 * src/lib/certificates/resolve-fields.ts, extended with fee/attendance/
 * contact groups that certificates never needed.
 */

export interface WhatsAppVariableSource {
  school: School;
  student?: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
    rollNumber: string | null;
    className: string;
    sectionName: string | null;
  };
  guardian?: { fullName: string; mobile: string | null };
  fee?: { pendingAmount: number; overdueAmount: number };
  attendance?: { pct: number; presentDays: number; totalDays: number };
  /** Excel-imported contacts — name plus whatever extra columns weren't mapped to a known field. */
  contact?: { name: string; customFields: Record<string, string> };
}

export function resolveVariableValues(src: WhatsAppVariableSource): Record<string, string> {
  const values: Record<string, string> = {
    "school.name": src.school.name,
    "school.phone": src.school.phone ?? "",
    "school.email": src.school.email ?? "",
    "school.address": [src.school.address, src.school.city, src.school.state].filter(Boolean).join(", "),
    "school.website": src.school.website ?? "",
    "school.principalName": src.school.principalName ?? "",
  };

  if (src.student) {
    values["student.name"] = [src.student.firstName, src.student.lastName].filter(Boolean).join(" ");
    values["student.admissionNumber"] = src.student.admissionNumber;
    values["student.class"] = src.student.className;
    values["student.section"] = src.student.sectionName ?? "";
    values["student.rollNumber"] = src.student.rollNumber ?? "";
  }

  if (src.guardian) {
    values["guardian.name"] = src.guardian.fullName;
    values["guardian.mobile"] = src.guardian.mobile ?? "";
  }

  if (src.fee) {
    values["fee.pendingAmount"] = String(Math.round(src.fee.pendingAmount));
    values["fee.overdueAmount"] = String(Math.round(src.fee.overdueAmount));
  }

  if (src.attendance) {
    values["attendance.pct"] = String(src.attendance.pct);
    values["attendance.presentDays"] = String(src.attendance.presentDays);
    values["attendance.totalDays"] = String(src.attendance.totalDays);
  }

  if (src.contact) {
    values["contact.name"] = src.contact.name;
    for (const [k, v] of Object.entries(src.contact.customFields)) values[`contact.custom.${k}`] = v;
  }

  return values;
}

/** Illustrative values for the template editor's live preview, before a real recipient is chosen — no Prisma/school data required, safe to import client-side. */
export const WHATSAPP_SAMPLE_VALUES: Record<string, string> = {
  "school.name": "Sunrise Public School",
  "school.phone": "+91 98765 43210",
  "school.email": "info@sunriseschool.example",
  "school.address": "MG Road, Bengaluru",
  "school.website": "www.sunriseschool.example",
  "school.principalName": "Mrs. Anita Rao",
  "student.name": "Aarav Sharma",
  "student.admissionNumber": "ADM2024015",
  "student.class": "8",
  "student.section": "A",
  "student.rollNumber": "23",
  "guardian.name": "Mr. Rajesh Sharma",
  "guardian.mobile": "+91 98765 12345",
  "fee.pendingAmount": "2,500",
  "fee.overdueAmount": "1,200",
  "attendance.pct": "68",
  "attendance.presentDays": "34",
  "attendance.totalDays": "50",
  "contact.name": "Aarav Sharma",
};

/** Grouped for the template editor's click-to-insert variable picker. */
export const WHATSAPP_VARIABLE_GROUPS: { label: string; fields: { key: string; label: string }[] }[] = [
  {
    label: "School",
    fields: [
      { key: "school.name", label: "School name" },
      { key: "school.phone", label: "School phone" },
      { key: "school.email", label: "School email" },
      { key: "school.address", label: "School address" },
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
    ],
  },
  {
    label: "Guardian",
    fields: [
      { key: "guardian.name", label: "Guardian name" },
      { key: "guardian.mobile", label: "Guardian mobile" },
    ],
  },
  {
    label: "Fees",
    fields: [
      { key: "fee.pendingAmount", label: "Pending amount" },
      { key: "fee.overdueAmount", label: "Overdue amount" },
    ],
  },
  {
    label: "Attendance",
    fields: [
      { key: "attendance.pct", label: "Attendance %" },
      { key: "attendance.presentDays", label: "Days present" },
      { key: "attendance.totalDays", label: "Total days" },
    ],
  },
  {
    label: "Imported contact",
    fields: [
      { key: "contact.name", label: "Contact name" },
      { key: "contact.custom.*", label: "Custom column (varies by import file, e.g. contact.custom.donorLevel)" },
    ],
  },
];
