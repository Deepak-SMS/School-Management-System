import "server-only";
import { prisma } from "@/lib/db";
import { requireSessionUserId } from "@/lib/session";

/**
 * Identity gate for the Super Admin (platform-level) area. A Super Admin is
 * a `User.isSuperAdmin` flag, independent of `SchoolMembership` — it belongs
 * to zero schools. This deliberately does not reuse getCurrentUser()/
 * getCurrentSchoolId() (src/lib/current-user.ts, src/lib/tenant.ts), which
 * assume exactly one active school membership per request.
 */

export class NotSuperAdminError extends Error {
  constructor() {
    super("This account does not have platform administrator access.");
    this.name = "NotSuperAdminError";
  }
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
}

export async function requireSuperAdmin(): Promise<PlatformUser> {
  const userId = await requireSessionUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isSuperAdmin: true, isActive: true },
  });
  if (!user || !user.isActive || !user.isSuperAdmin) throw new NotSuperAdminError();
  return { id: user.id, name: user.name, email: user.email };
}
