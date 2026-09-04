import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { requireSessionUserId } from "@/lib/session";
import type { Role } from "@/types/user";

/**
 * Resolves "who is making this request" from the real session, scoped to the
 * school `getCurrentSchoolId()` resolves. Every HR/permission-checked route
 * reads identity through this one function — see src/lib/authorize.ts.
 */

export interface RequestUser {
  id: string;
  name: string;
  role: Role;
  schoolId: string;
}

export class NotAMemberError extends Error {
  constructor() {
    super("This account does not have access to this school.");
    this.name = "NotAMemberError";
  }
}

export async function getCurrentUser(): Promise<RequestUser> {
  const [userId, schoolId] = await Promise.all([requireSessionUserId(), getCurrentSchoolId()]);

  const membership = await prisma.schoolMembership.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
    include: { user: { select: { name: true } } },
  });
  if (!membership) throw new NotAMemberError();

  return {
    id: userId,
    name: membership.user.name,
    role: membership.role as Role,
    schoolId,
  };
}
