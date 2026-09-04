import { format } from "date-fns";
import type { School } from "@/generated/prisma/client";

/**
 * Built-in ERP variable resolution for email templates. Same {{field.key}}
 * dot-path convention as src/lib/whatsapp/variables.ts and
 * src/lib/certificates/resolve-fields.ts, extended with the richer academic/
 * fee/exam fields email needs that WhatsApp's shorter set doesn't.
 */

export interface EmailVariableSource {
  school: School;
  student?: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
    rollNumber: string | null;
    dateOfBirth: Date | null;
    className: string;
    sectionName: string | null;
  };
  guardian?: { fullName: string; email: string | null; mobile: string | null; relationship?: string };
  /** A second guardian, when the template wants to name father/mother separately rather than just "the" primary guardian. */
  father?: { fullName: string };
  mother?: { fullName: string };
  fee?: {
    totalFees: number;
    paidFees: number;
    pendingFees: number;
    discount: number;
    dueAmount: number;
    dueDate: Date | null;
    receiptNumber: string | null;
    lastPaymentDate: Date | null;
  };
  academic?: { academicYear: string; examName?: string; examDate?: Date | null };
  /** Excel-imported recipients — name plus whatever extra columns weren't mapped to a known field. */
  contact?: { name: string; customFields: Record<string, string> };
}

function dateStr(d: Date | null | undefined): string {
  return d ? format(d, "dd MMM yyyy") : "";
}

export function resolveVariableValues(src: EmailVariableSource): Record<string, string> {
  const values: Record<string, string> = {
    "school.name": src.school.name,
    "school.address": [src.school.address, src.school.city, src.school.state].filter(Boolean).join(", "),
    "school.phone": src.school.phone ?? "",
    "school.email": src.school.email ?? "",
    "school.website": src.school.website ?? "",
    "current.date": dateStr(new Date()),
  };

  if (src.student) {
    const fullName = [src.student.firstName, src.student.lastName].filter(Boolean).join(" ");
    values["student.name"] = fullName;
    values["student.first_name"] = src.student.firstName;
    values["student.last_name"] = src.student.lastName;
    values["student.admission_number"] = src.student.admissionNumber;
    values["student.roll_number"] = src.student.rollNumber ?? "";
    values["student.class_name"] = src.student.className;
    values["student.section_name"] = src.student.sectionName ?? "";
    values["student.date_of_birth"] = dateStr(src.student.dateOfBirth);
  }

  if (src.guardian) {
    values["parent.name"] = src.guardian.fullName;
    values["parent.email"] = src.guardian.email ?? "";
    values["parent.phone"] = src.guardian.mobile ?? "";
    values["parent.guardian_name"] = src.guardian.fullName;
  }
  if (src.father) values["parent.father_name"] = src.father.fullName;
  if (src.mother) values["parent.mother_name"] = src.mother.fullName;

  if (src.fee) {
    values["fee.total_fees"] = String(Math.round(src.fee.totalFees));
    values["fee.paid_fees"] = String(Math.round(src.fee.paidFees));
    values["fee.pending_fees"] = String(Math.round(src.fee.pendingFees));
    values["fee.discount"] = String(Math.round(src.fee.discount));
    values["fee.due_amount"] = String(Math.round(src.fee.dueAmount));
    values["fee.due_date"] = dateStr(src.fee.dueDate);
    values["fee.receipt_number"] = src.fee.receiptNumber ?? "";
    values["fee.last_payment_date"] = dateStr(src.fee.lastPaymentDate);
  }

  if (src.academic) {
    values["academic.year"] = src.academic.academicYear;
    if (src.academic.examName) values["academic.exam_name"] = src.academic.examName;
    if (src.academic.examDate !== undefined) values["academic.exam_date"] = dateStr(src.academic.examDate);
  }

  if (src.contact) {
    values["contact.name"] = src.contact.name;
    for (const [k, v] of Object.entries(src.contact.customFields)) values[`contact.custom.${k}`] = v;
  }

  return values;
}

/** Illustrative values for the template editor's live preview, before a real recipient is chosen — no Prisma/school data required, safe to import client-side. */
export const EMAIL_SAMPLE_VALUES: Record<string, string> = {
  "school.name": "ABC International School",
  "school.address": "MG Road, Bengaluru",
  "school.phone": "+91 80 4567 8900",
  "school.email": "info@abcschool.example",
  "school.website": "www.abcschool.example",
  "current.date": format(new Date(), "dd MMM yyyy"),
  "student.name": "Rahul Sharma",
  "student.first_name": "Rahul",
  "student.last_name": "Sharma",
  "student.admission_number": "ADM2024015",
  "student.roll_number": "23",
  "student.class_name": "8",
  "student.section_name": "A",
  "student.date_of_birth": "12 Jun 2013",
  "parent.name": "Mr. Sharma",
  "parent.email": "parent@example.com",
  "parent.phone": "+91 98765 43210",
  "parent.guardian_name": "Mr. Sharma",
  "parent.father_name": "Mr. Sharma",
  "parent.mother_name": "Mrs. Sharma",
  "fee.total_fees": "50000",
  "fee.paid_fees": "40000",
  "fee.pending_fees": "10000",
  "fee.discount": "0",
  "fee.due_amount": "10000",
  "fee.due_date": "15 Sep 2026",
  "fee.receipt_number": "RCPT-2026-00123",
  "fee.last_payment_date": "01 Jul 2026",
  "academic.year": "2026-27",
  "contact.name": "Rahul Sharma",
};

/** Grouped for the template editor's click-to-insert variable picker. */
export const EMAIL_VARIABLE_GROUPS: { label: string; fields: { key: string; label: string }[] }[] = [
  {
    label: "Student",
    fields: [
      { key: "student.name", label: "Full name" },
      { key: "student.first_name", label: "First name" },
      { key: "student.last_name", label: "Last name" },
      { key: "student.admission_number", label: "Admission number" },
      { key: "student.roll_number", label: "Roll number" },
      { key: "student.class_name", label: "Class" },
      { key: "student.section_name", label: "Section" },
      { key: "student.date_of_birth", label: "Date of birth" },
    ],
  },
  {
    label: "Parent",
    fields: [
      { key: "parent.name", label: "Parent name" },
      { key: "parent.father_name", label: "Father's name" },
      { key: "parent.mother_name", label: "Mother's name" },
      { key: "parent.guardian_name", label: "Guardian name" },
      { key: "parent.email", label: "Parent email" },
      { key: "parent.phone", label: "Parent phone" },
    ],
  },
  {
    label: "Fees",
    fields: [
      { key: "fee.total_fees", label: "Total fees" },
      { key: "fee.paid_fees", label: "Paid fees" },
      { key: "fee.pending_fees", label: "Pending fees" },
      { key: "fee.discount", label: "Discount" },
      { key: "fee.due_amount", label: "Due amount" },
      { key: "fee.due_date", label: "Due date" },
      { key: "fee.receipt_number", label: "Fee receipt number" },
      { key: "fee.last_payment_date", label: "Last payment date" },
    ],
  },
  {
    label: "School",
    fields: [
      { key: "school.name", label: "School name" },
      { key: "school.address", label: "School address" },
      { key: "school.phone", label: "School phone" },
      { key: "school.email", label: "School email" },
      { key: "school.website", label: "School website" },
    ],
  },
  {
    label: "Academic",
    fields: [
      { key: "academic.year", label: "Academic year" },
      { key: "academic.exam_name", label: "Exam name" },
      { key: "academic.exam_date", label: "Exam date" },
    ],
  },
  {
    label: "System",
    fields: [{ key: "current.date", label: "Current date" }],
  },
  {
    label: "Imported contact",
    fields: [
      { key: "contact.name", label: "Contact name" },
      { key: "contact.custom.*", label: "Custom column (varies by import file)" },
    ],
  },
];
