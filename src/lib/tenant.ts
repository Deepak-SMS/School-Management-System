import { prisma } from "@/lib/db";
import { requireSessionUserId } from "@/lib/session";

/**
 * Resolves "which school is this request for" from the signed-in user's
 * earliest school membership. Every tenant-scoped query in the codebase
 * filters by the value this returns — see AUTH-RBAC-ROADMAP.md Phase 3.
 *
 * Once a school switcher is wired up (multi-school users), this should read
 * the active school from the session instead of always picking the first
 * membership. Never accept a school id from client-supplied input (query
 * string, body, header) as the source of truth here — that would let any
 * client read another school's data.
 */
export class NoSchoolMembershipError extends Error {
  constructor() {
    super("This account is not a member of any school.");
    this.name = "NoSchoolMembershipError";
  }
}

export async function getCurrentSchoolId(): Promise<string> {
  const userId = await requireSessionUserId();
  const membership = await prisma.schoolMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { schoolId: true },
  });
  if (!membership) throw new NoSchoolMembershipError();
  return membership.schoolId;
}
