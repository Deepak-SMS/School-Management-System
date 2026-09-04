import { prisma } from "@/lib/db";
import { requireSessionUserId } from "@/lib/session";
import { getCurrentSchoolId } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/current-user";
import type { PortalChild } from "@/types/portal";

export class NotAGuardianError extends Error {
  constructor() {
    super("This account is not linked to a guardian record.");
    this.name = "NotAGuardianError";
  }
}

export class NotAPortalStudentError extends Error {
  constructor() {
    super("This account is not linked to a student record.");
    this.name = "NotAPortalStudentError";
  }
}

export class PortalStudentAccessError extends Error {
  constructor() {
    super("You don't have access to this student's information.");
    this.name = "PortalStudentAccessError";
  }
}

export class NotAPortalRoleError extends Error {
  constructor() {
    super("This account doesn't have portal access.");
    this.name = "NotAPortalRoleError";
  }
}

/** Resolves the Guardian record linked to the signed-in user, within their current school. */
export async function getCurrentGuardian() {
  const [userId, schoolId] = await Promise.all([requireSessionUserId(), getCurrentSchoolId()]);
  const guardian = await prisma.guardian.findFirst({ where: { userId, schoolId } });
  if (!guardian) throw new NotAGuardianError();
  return guardian;
}

/** Resolves the Student record linked to the signed-in user, within their current school. */
export async function getCurrentStudentSelf() {
  const [userId, schoolId] = await Promise.all([requireSessionUserId(), getCurrentSchoolId()]);
  const student = await prisma.student.findFirst({ where: { userId, schoolId } });
  if (!student) throw new NotAPortalStudentError();
  return student;
}

/**
 * The children a guardian may see inside the portal — only pairings explicitly
 * marked `canAccessPortal`. A guardian record and a "may use the portal for
 * this specific child" grant are deliberately separate (see StudentGuardian),
 * so this never falls back to "every linked child."
 */
export async function getPortalChildrenForGuardian(guardian: { id: string }): Promise<PortalChild[]> {
  const links = await prisma.studentGuardian.findMany({
    where: { guardianId: guardian.id, canAccessPortal: true },
    orderBy: { sortOrder: "asc" },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          classId: true,
          class: { select: { name: true } },
          sectionId: true,
          section: { select: { name: true } },
        },
      },
    },
  });

  return links.map((link) => ({
    id: link.student.id,
    firstName: link.student.firstName,
    lastName: link.student.lastName,
    photoUrl: link.student.photoUrl,
    classId: link.student.classId,
    className: link.student.class.name,
    sectionId: link.student.sectionId,
    sectionName: link.student.section?.name ?? null,
  }));
}

/**
 * The one check every portal API route makes before touching student data.
 *
 * A parent may ask about any of their own portal-visible children (picked via
 * `studentId`, defaulting to the first); a student may only ever ask about
 * themselves, regardless of what `studentId` says. Never trust the query
 * param past this function — it is the actual authorization boundary, not a
 * UI convenience.
 */
export async function resolvePortalStudent(
  requestedStudentId: string | null,
): Promise<{ studentId: string; role: "parent" | "student" }> {
  const user = await getCurrentUser();

  if (user.role === "student") {
    const self = await getCurrentStudentSelf();
    return { studentId: self.id, role: "student" };
  }

  if (user.role === "parent") {
    const guardian = await getCurrentGuardian();
    const children = await getPortalChildrenForGuardian(guardian);
    const chosen = requestedStudentId ? children.find((c) => c.id === requestedStudentId) : children[0];
    if (!chosen) throw new PortalStudentAccessError();
    return { studentId: chosen.id, role: "parent" };
  }

  throw new NotAPortalRoleError();
}
