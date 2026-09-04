import { prisma } from "@/lib/db";
import { getFeeDefaulters } from "@/lib/ai/analytics/fees-analytics";
import { getLowAttendanceStudents } from "@/lib/ai/analytics/attendance-analytics";
import type { AudienceMode } from "@/lib/ai/communication/audience-modes";

export type { AudienceMode } from "@/lib/ai/communication/audience-modes";

export interface ResolvedRecipient {
  name: string;
  email: string | null;
  /** e.g. "for Aarav Sharma (Class 8A)" — folded into the prompt context so the draft can honestly reference specifics without the LLM inventing them. */
  context?: string;
}

export interface ResolvedAudience {
  label: string;
  recipients: ResolvedRecipient[];
  /** How many resolved recipients have no email on file — shown so the sender knows the real reach, not just the headcount. */
  missingEmailCount: number;
  /** Folded into the generation prompt as real, backend-computed context. */
  promptContext: string;
}

interface AudienceParams {
  schoolId: string;
  classId?: string;
  sectionId?: string;
  thresholdPct?: number;
  daysBack?: number;
}

async function primaryGuardianRecipients(studentIds: string[]): Promise<Map<string, { name: string; email: string | null }>> {
  if (studentIds.length === 0) return new Map();
  const links = await prisma.studentGuardian.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: { studentId: true, guardian: { select: { fullName: true, email: true } } },
  });
  const byStudent = new Map<string, { name: string; email: string | null }>();
  for (const link of links) {
    if (!byStudent.has(link.studentId)) byStudent.set(link.studentId, { name: link.guardian.fullName, email: link.guardian.email });
  }
  return byStudent;
}

export async function resolveAudience(mode: AudienceMode, params: AudienceParams): Promise<ResolvedAudience> {
  if (mode === "fee_defaulters") {
    const defaulters = await getFeeDefaulters({ schoolId: params.schoolId, classId: params.classId, sectionId: params.sectionId });
    const guardians = await primaryGuardianRecipients(defaulters.map((d) => d.studentId));
    const recipients: ResolvedRecipient[] = defaulters.map((d) => {
      const guardian = guardians.get(d.studentId);
      return {
        name: guardian?.name ?? `Guardian of ${d.name}`,
        email: guardian?.email ?? null,
        context: `${d.name} (${d.className}${d.sectionName ? ` ${d.sectionName}` : ""}) — ₹${Math.round(d.overdue).toLocaleString("en-IN")} overdue`,
      };
    });
    return {
      label: `Fee defaulters${params.classId ? " in this class" : ""} (${recipients.length})`,
      recipients,
      missingEmailCount: recipients.filter((r) => !r.email).length,
      promptContext: `${recipients.length} students have overdue fees. Examples: ${recipients.slice(0, 5).map((r) => r.context).join("; ")}.`,
    };
  }

  if (mode === "low_attendance_parents") {
    const from = new Date(Date.now() - (params.daysBack ?? 30) * 24 * 60 * 60 * 1000);
    const students = await getLowAttendanceStudents({
      schoolId: params.schoolId,
      classId: params.classId,
      sectionId: params.sectionId,
      from,
      to: new Date(),
      thresholdPct: params.thresholdPct ?? 75,
    });
    const guardians = await primaryGuardianRecipients(students.map((s) => s.studentId));
    const recipients: ResolvedRecipient[] = students.map((s) => {
      const guardian = guardians.get(s.studentId);
      return {
        name: guardian?.name ?? `Guardian of ${s.name}`,
        email: guardian?.email ?? null,
        context: `${s.name} (${s.className}${s.sectionName ? ` ${s.sectionName}` : ""}) — ${s.pct}% attendance`,
      };
    });
    return {
      label: `Parents of students below ${params.thresholdPct ?? 75}% attendance (${recipients.length})`,
      recipients,
      missingEmailCount: recipients.filter((r) => !r.email).length,
      promptContext: `${recipients.length} students are below ${params.thresholdPct ?? 75}% attendance. Examples: ${recipients.slice(0, 5).map((r) => r.context).join("; ")}.`,
    };
  }

  if (mode === "class_parents") {
    const students = await prisma.student.findMany({
      where: { schoolId: params.schoolId, status: "active", ...(params.classId && { classId: params.classId }), ...(params.sectionId && { sectionId: params.sectionId }) },
      select: { id: true, firstName: true, lastName: true },
    });
    const guardians = await primaryGuardianRecipients(students.map((s) => s.id));
    const recipients: ResolvedRecipient[] = students.map((s) => {
      const guardian = guardians.get(s.id);
      return { name: guardian?.name ?? `Guardian of ${s.firstName} ${s.lastName}`, email: guardian?.email ?? null };
    });
    return {
      label: `Parents of this class (${recipients.length})`,
      recipients,
      missingEmailCount: recipients.filter((r) => !r.email).length,
      promptContext: `Addressed to the parents of ${recipients.length} students in this class.`,
    };
  }

  if (mode === "all_staff") {
    const staff = await prisma.staff.findMany({
      where: { schoolId: params.schoolId, employmentStatus: "active" },
      select: { fullName: true, email: true },
    });
    return {
      label: `All active staff (${staff.length})`,
      recipients: staff.map((s) => ({ name: s.fullName, email: s.email })),
      missingEmailCount: staff.filter((s) => !s.email).length,
      promptContext: `Addressed to all ${staff.length} active staff members.`,
    };
  }

  // custom — no real recipient list resolved; the message is drafted from the free-text audience description only.
  return { label: "Custom audience", recipients: [], missingEmailCount: 0, promptContext: "" };
}
