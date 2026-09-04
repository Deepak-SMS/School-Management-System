import { prisma } from "@/lib/db";
import { summarizeStudentFees } from "@/lib/student-fee-ledger";
import { getFeeDefaulters } from "@/lib/ai/analytics/fees-analytics";
import { resolveVariableValues } from "@/lib/email-campaigns/variables";
import type { EmailRecipientType } from "@/lib/email-campaigns/recipient-types";

export type { EmailRecipientType } from "@/lib/email-campaigns/recipient-types";

export interface ResolvedEmailRecipient {
  name: string;
  emailRaw: string | null;
  studentId?: string;
  variableValues: Record<string, string>;
}

export interface ResolvedEmailAudience {
  label: string;
  recipients: ResolvedEmailRecipient[];
}

export interface EmailAudienceParams {
  schoolId: string;
  studentIds?: string[];
  classIds?: string[];
  sectionIds?: string[];
  minPendingAmount?: number;
  /** Excel-imported rows, already validated — used only for recipientType "imported_list". */
  importedRows?: { name: string; email: string; customFields: Record<string, string> }[];
}

const CHARGE_SELECT = {
  id: true,
  amount: true,
  dueDate: true,
  status: true,
  adjustments: { select: { type: true, amount: true } },
  allocations: { select: { amount: true, payment: { select: { status: true } } } },
} as const;

/** Batches the per-student fee facts (ledger summary, next due date, last payment, latest receipt) this module's variables need — one query per fact across the whole student list, not one query per student. */
async function batchFeeFacts(schoolId: string, studentIds: string[]) {
  if (studentIds.length === 0) return new Map();

  const [students, payments, receipts] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, feeCharges: { select: CHARGE_SELECT } } }),
    prisma.payment.findMany({
      where: { schoolId, studentId: { in: studentIds }, status: "recorded" },
      select: { studentId: true, paidOn: true },
      orderBy: { paidOn: "desc" },
    }),
    prisma.receipt.findMany({
      where: { schoolId, studentId: { in: studentIds } },
      select: { studentId: true, receiptNumber: true, issuedOn: true },
      orderBy: { issuedOn: "desc" },
    }),
  ]);

  const lastPaymentByStudent = new Map<string, Date>();
  for (const p of payments) if (!lastPaymentByStudent.has(p.studentId)) lastPaymentByStudent.set(p.studentId, p.paidOn);

  const latestReceiptByStudent = new Map<string, string>();
  for (const r of receipts) if (!latestReceiptByStudent.has(r.studentId)) latestReceiptByStudent.set(r.studentId, r.receiptNumber);

  const facts = new Map<
    string,
    { totalFees: number; paidFees: number; pendingFees: number; discount: number; dueAmount: number; dueDate: Date | null; receiptNumber: string | null; lastPaymentDate: Date | null }
  >();

  for (const s of students) {
    const summary = summarizeStudentFees(s.feeCharges);
    const nextDue = s.feeCharges
      .filter((c) => c.status !== "cancelled" && c.dueDate)
      .map((c) => c.dueDate as Date)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    facts.set(s.id, {
      totalFees: summary.totalCharged,
      paidFees: summary.totalPaid,
      pendingFees: summary.totalPending,
      discount: summary.totalWaived,
      dueAmount: summary.totalOverdue,
      dueDate: nextDue,
      receiptNumber: latestReceiptByStudent.get(s.id) ?? null,
      lastPaymentDate: lastPaymentByStudent.get(s.id) ?? null,
    });
  }

  return facts;
}

async function primaryGuardiansByStudent(studentIds: string[]) {
  if (studentIds.length === 0) return new Map();
  const links = await prisma.studentGuardian.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: { studentId: true, relationship: true, guardian: { select: { fullName: true, email: true, mobile: true } } },
  });
  const byStudent = new Map<string, { primary: { fullName: string; email: string | null; mobile: string | null }; father?: string; mother?: string }>();
  for (const link of links) {
    const bucket = byStudent.get(link.studentId) ?? { primary: link.guardian };
    if (link.relationship === "father") bucket.father = link.guardian.fullName;
    if (link.relationship === "mother") bucket.mother = link.guardian.fullName;
    byStudent.set(link.studentId, bucket);
  }
  return byStudent;
}

async function resolveStudentAudience(
  schoolId: string,
  students: { id: string; firstName: string; lastName: string; admissionNumber: string; rollNumber: string | null; dateOfBirth: Date | null; className: string; sectionName: string | null }[],
  opts: { includeFeeFacts: boolean } = { includeFeeFacts: false },
): Promise<ResolvedEmailRecipient[]> {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  const studentIds = students.map((s) => s.id);
  const [guardians, feeFacts] = await Promise.all([
    primaryGuardiansByStudent(studentIds),
    opts.includeFeeFacts ? batchFeeFacts(schoolId, studentIds) : Promise.resolve(new Map()),
  ]);

  return students.map((s) => {
    const g = guardians.get(s.id);
    const fee = feeFacts.get(s.id);
    return {
      name: g?.primary.fullName ?? `Guardian of ${s.firstName} ${s.lastName}`,
      emailRaw: g?.primary.email ?? null,
      studentId: s.id,
      variableValues: resolveVariableValues({
        school,
        student: s,
        guardian: g ? { fullName: g.primary.fullName, email: g.primary.email, mobile: g.primary.mobile } : undefined,
        father: g?.father ? { fullName: g.father } : undefined,
        mother: g?.mother ? { fullName: g.mother } : undefined,
        fee,
      }),
    };
  });
}

const STUDENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  admissionNumber: true,
  rollNumber: true,
  dateOfBirth: true,
  class: { select: { name: true } },
  section: { select: { name: true } },
} as const;

function shapeStudent<T extends { class: { name: string }; section: { name: string } | null }>(s: T) {
  return { ...s, className: s.class.name, sectionName: s.section?.name ?? null };
}

/**
 * Resolves a real recipient list server-side from schoolId — never trusts a
 * client-supplied list, same discipline the WhatsApp module already
 * established. Fee amounts always come from the real ledger
 * (summarizeStudentFees), never from anything the frontend supplies — a
 * tampered request can't change what a fee reminder says.
 */
export async function resolveEmailAudience(type: EmailRecipientType, params: EmailAudienceParams): Promise<ResolvedEmailAudience> {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: params.schoolId } });

  if (type === "fee_defaulters") {
    const defaulters = await getFeeDefaulters({ schoolId: params.schoolId });
    const eligibleIds = defaulters.filter((d) => d.overdue >= (params.minPendingAmount ?? 0) || d.pending >= (params.minPendingAmount ?? 0)).map((d) => d.studentId);
    const students = await prisma.student.findMany({
      where: {
        id: { in: eligibleIds },
        ...(params.classIds?.length && { classId: { in: params.classIds } }),
        ...(params.sectionIds?.length && { sectionId: { in: params.sectionIds } }),
      },
      select: STUDENT_SELECT,
    });
    const recipients = await resolveStudentAudience(params.schoolId, students.map(shapeStudent), { includeFeeFacts: true });
    return { label: `Students with pending fees (${recipients.length})`, recipients };
  }

  if (type === "all_students" || type === "classes" || type === "sections") {
    const students = await prisma.student.findMany({
      where: {
        schoolId: params.schoolId,
        status: "active",
        ...(type === "classes" && params.classIds?.length && { classId: { in: params.classIds } }),
        ...(type === "sections" && params.sectionIds?.length && { sectionId: { in: params.sectionIds } }),
      },
      select: STUDENT_SELECT,
    });
    const recipients = await resolveStudentAudience(params.schoolId, students.map(shapeStudent));
    const label = type === "all_students" ? "All students" : type === "classes" ? "Selected classes" : "Selected sections";
    return { label: `${label} (${recipients.length})`, recipients };
  }

  if (type === "selected_students") {
    const students = await prisma.student.findMany({ where: { id: { in: params.studentIds ?? [] }, schoolId: params.schoolId }, select: STUDENT_SELECT });
    const recipients = await resolveStudentAudience(params.schoolId, students.map(shapeStudent), { includeFeeFacts: true });
    return { label: `Selected students (${recipients.length})`, recipients };
  }

  if (type === "parents") {
    const students = await prisma.student.findMany({ where: { schoolId: params.schoolId, status: "active" }, select: STUDENT_SELECT });
    const recipients = await resolveStudentAudience(params.schoolId, students.map(shapeStudent));
    return { label: `All parents (${recipients.length})`, recipients };
  }

  if (type === "teachers" || type === "staff") {
    const staff = await prisma.staff.findMany({
      where: {
        schoolId: params.schoolId,
        employmentStatus: "active",
        ...(type === "teachers" && {
          OR: [{ subjectAssignments: { some: {} } }, { sectionsAsTeacher: { some: {} } }, { classesAsTeacher: { some: {} } }],
        }),
      },
      select: { fullName: true, email: true },
    });
    const recipients: ResolvedEmailRecipient[] = staff.map((s) => ({
      name: s.fullName,
      emailRaw: s.email,
      variableValues: resolveVariableValues({ school, contact: { name: s.fullName, customFields: {} } }),
    }));
    return { label: `${type === "teachers" ? "Teachers" : "All staff"} (${recipients.length})`, recipients };
  }

  // imported_list
  const recipients: ResolvedEmailRecipient[] = (params.importedRows ?? []).map((row) => ({
    name: row.name,
    emailRaw: row.email,
    variableValues: resolveVariableValues({ school, contact: { name: row.name, customFields: row.customFields } }),
  }));
  return { label: `Excel import (${recipients.length})`, recipients };
}
