import { prisma } from "@/lib/db";
import { getFeeDefaulters } from "@/lib/ai/analytics/fees-analytics";
import { getLowAttendanceStudents } from "@/lib/ai/analytics/attendance-analytics";
import { resolveVariableValues } from "@/lib/whatsapp/variables";
import type { WhatsAppAudienceMode } from "@/lib/whatsapp/audience-modes";

export type { WhatsAppAudienceMode } from "@/lib/whatsapp/audience-modes";

/** Section's own class teacher takes priority over the class's, matching how a school actually thinks about "who to check with" for one class. Used by the campaign wizard's Audience-step preview. */
export async function getClassTeacherName(classId?: string, sectionId?: string): Promise<string | null> {
  if (sectionId) {
    const section = await prisma.section.findUnique({ where: { id: sectionId }, select: { classTeacher: { select: { fullName: true } } } });
    if (section?.classTeacher) return section.classTeacher.fullName;
  }
  if (classId) {
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { classTeacher: { select: { fullName: true } } } });
    if (cls?.classTeacher) return cls.classTeacher.fullName;
  }
  return null;
}

export interface ResolvedWhatsAppRecipient {
  name: string;
  /** As found in source data, before normalization — see src/lib/whatsapp/phone.ts. */
  phoneRaw: string | null;
  studentId?: string;
  guardianId?: string;
  /** Set only when the recipient already came from the address book (manual/tag/imported modes) — student/guardian-derived modes leave this unset until enqueue time, which is when the matching contact is looked up/created. */
  contactId?: string;
  variableValues: Record<string, string>;
}

export interface ResolvedWhatsAppAudience {
  label: string;
  recipients: ResolvedWhatsAppRecipient[];
}

export interface WhatsAppAudienceParams {
  schoolId: string;
  classId?: string;
  sectionId?: string;
  thresholdPct?: number;
  tag?: string;
  contactIds?: string[];
}

function channelAllowsWhatsApp(commChannelsJson: string | null): boolean {
  if (!commChannelsJson) return true; // not configured — don't exclude
  try {
    const channels = JSON.parse(commChannelsJson) as unknown;
    return !Array.isArray(channels) || channels.includes("whatsapp");
  } catch {
    return true;
  }
}

async function primaryGuardianByStudent(studentIds: string[]): Promise<Map<string, { fullName: string; mobile: string | null }>> {
  if (studentIds.length === 0) return new Map();
  const links = await prisma.studentGuardian.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: { studentId: true, guardian: { select: { fullName: true, mobile: true } } },
  });
  const byStudent = new Map<string, { fullName: string; mobile: string | null }>();
  for (const link of links) {
    if (!byStudent.has(link.studentId)) byStudent.set(link.studentId, link.guardian);
  }
  return byStudent;
}

function parseCustomFields(customFieldsJson: string | null): Record<string, string> {
  if (!customFieldsJson) return {};
  try {
    const fields = JSON.parse(customFieldsJson) as unknown;
    return fields && typeof fields === "object" ? (fields as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Resolves a real recipient list server-side from schoolId — never trusts a
 * client-supplied list, same discipline src/lib/ai/communication/audience.ts
 * already established for the AI Communication Assistant. Read-only: does not
 * write WhatsAppContact rows (that happens in enqueue.ts, once, at confirmed
 * send time) so this is safe to call repeatedly for wizard previews.
 */
export async function resolveWhatsAppAudience(mode: WhatsAppAudienceMode, params: WhatsAppAudienceParams): Promise<ResolvedWhatsAppAudience> {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: params.schoolId } });

  if (mode === "fee_defaulters") {
    const defaulters = await getFeeDefaulters({ schoolId: params.schoolId, classId: params.classId, sectionId: params.sectionId });
    const guardians = await primaryGuardianByStudent(defaulters.map((d) => d.studentId));
    const students = await prisma.student.findMany({
      where: { id: { in: defaulters.map((d) => d.studentId) } },
      select: { id: true, whatsappNumber: true, commChannelsJson: true, firstName: true, lastName: true, admissionNumber: true, rollNumber: true },
    });
    const studentById = new Map(students.map((s) => [s.id, s]));

    const recipients: ResolvedWhatsAppRecipient[] = defaulters
      .filter((d) => channelAllowsWhatsApp(studentById.get(d.studentId)?.commChannelsJson ?? null))
      .map((d) => {
        const guardian = guardians.get(d.studentId);
        const s = studentById.get(d.studentId);
        return {
          name: guardian?.fullName ?? `Guardian of ${d.name}`,
          phoneRaw: s?.whatsappNumber || guardian?.mobile || null,
          studentId: d.studentId,
          variableValues: resolveVariableValues({
            school,
            student: s ? { firstName: s.firstName, lastName: s.lastName, admissionNumber: s.admissionNumber, rollNumber: s.rollNumber, className: d.className, sectionName: d.sectionName } : undefined,
            guardian: guardian ? { fullName: guardian.fullName, mobile: guardian.mobile } : undefined,
            fee: { pendingAmount: d.pending, overdueAmount: d.overdue },
          }),
        };
      });
    return { label: `Fee defaulters${params.classId ? " in this class" : ""} (${recipients.length})`, recipients };
  }

  if (mode === "low_attendance_parents") {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const students = await getLowAttendanceStudents({
      schoolId: params.schoolId,
      classId: params.classId,
      sectionId: params.sectionId,
      from,
      to: new Date(),
      thresholdPct: params.thresholdPct ?? 75,
    });
    const guardians = await primaryGuardianByStudent(students.map((s) => s.studentId));
    const studentRows = await prisma.student.findMany({
      where: { id: { in: students.map((s) => s.studentId) } },
      select: { id: true, whatsappNumber: true, commChannelsJson: true, firstName: true, lastName: true, admissionNumber: true, rollNumber: true },
    });
    const studentById = new Map(studentRows.map((s) => [s.id, s]));

    const recipients: ResolvedWhatsAppRecipient[] = students
      .filter((st) => channelAllowsWhatsApp(studentById.get(st.studentId)?.commChannelsJson ?? null))
      .map((st) => {
        const guardian = guardians.get(st.studentId);
        const s = studentById.get(st.studentId);
        return {
          name: guardian?.fullName ?? `Guardian of ${st.name}`,
          phoneRaw: s?.whatsappNumber || guardian?.mobile || null,
          studentId: st.studentId,
          variableValues: resolveVariableValues({
            school,
            student: s ? { firstName: s.firstName, lastName: s.lastName, admissionNumber: s.admissionNumber, rollNumber: s.rollNumber, className: st.className, sectionName: st.sectionName } : undefined,
            guardian: guardian ? { fullName: guardian.fullName, mobile: guardian.mobile } : undefined,
            attendance: { pct: st.pct, presentDays: st.presentDays, totalDays: st.totalDays },
          }),
        };
      });
    return { label: `Parents of students below ${params.thresholdPct ?? 75}% attendance (${recipients.length})`, recipients };
  }

  if (mode === "class_parents" || mode === "all_guardians") {
    const students = await prisma.student.findMany({
      where: {
        schoolId: params.schoolId,
        status: "active",
        ...(mode === "class_parents" && params.classId && { classId: params.classId }),
        ...(mode === "class_parents" && params.sectionId && { sectionId: params.sectionId }),
      },
      select: {
        id: true,
        whatsappNumber: true,
        commChannelsJson: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        rollNumber: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });
    const guardians = await primaryGuardianByStudent(students.map((s) => s.id));

    const recipients: ResolvedWhatsAppRecipient[] = students
      .filter((s) => channelAllowsWhatsApp(s.commChannelsJson))
      .map((s) => {
        const guardian = guardians.get(s.id);
        return {
          name: guardian?.fullName ?? `Guardian of ${s.firstName} ${s.lastName}`,
          phoneRaw: s.whatsappNumber || guardian?.mobile || null,
          studentId: s.id,
          variableValues: resolveVariableValues({
            school,
            student: { firstName: s.firstName, lastName: s.lastName, admissionNumber: s.admissionNumber, rollNumber: s.rollNumber, className: s.class.name, sectionName: s.section?.name ?? null },
            guardian: guardian ? { fullName: guardian.fullName, mobile: guardian.mobile } : undefined,
          }),
        };
      });
    const label = mode === "all_guardians" ? `All guardians (${recipients.length})` : `Parents of this class (${recipients.length})`;
    return { label, recipients };
  }

  // manual_contacts | tag | imported_list — all resolve from the address book.
  const where =
    mode === "manual_contacts"
      ? { schoolId: params.schoolId, id: { in: params.contactIds ?? [] } }
      : mode === "imported_list"
        ? { schoolId: params.schoolId, source: "import", isActive: true }
        : { schoolId: params.schoolId, isActive: true, tagsJson: { contains: params.tag ? `"${params.tag}"` : " " } };

  const contacts = await prisma.whatsAppContact.findMany({ where });
  const recipients: ResolvedWhatsAppRecipient[] = contacts.map((c) => ({
    name: c.name,
    phoneRaw: c.rawPhone || c.phoneE164,
    studentId: c.studentId ?? undefined,
    guardianId: c.guardianId ?? undefined,
    contactId: c.id,
    variableValues: resolveVariableValues({ school, contact: { name: c.name, customFields: parseCustomFields(c.customFieldsJson) } }),
  }));

  const label =
    mode === "manual_contacts"
      ? `Selected contacts (${recipients.length})`
      : mode === "imported_list"
        ? `Most recent Excel import (${recipients.length})`
        : `Contacts tagged "${params.tag ?? ""}" (${recipients.length})`;
  return { label, recipients };
}
