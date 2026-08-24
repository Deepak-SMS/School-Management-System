import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import type { Role } from "@/types/user";

/**
 * Pre-auth placeholder for "who is making this request", mirroring
 * `getCurrentSchoolId()` in src/lib/tenant.ts.
 *
 * There is no login/session yet. This resolves the school's first membership as
 * the acting user so audit rows record a real user id instead of a fabricated
 * string, and so permission checks have a role to test against.
 *
 * When auth ships, replace the body of `getCurrentUser()` with the session
 * lookup — every HR route already reads identity through this one function, and
 * the dev override below must be deleted at the same time.
 */

export interface RequestUser {
  /** Null until a User row exists for the acting person — audit rows tolerate this. */
  id: string | null;
  name: string;
  role: Role;
  schoolId: string;
}

const DEV_ROLE_COOKIE = "dev-role";
const DEV_ROLE_HEADER = "x-dev-role";

const ROLES: readonly Role[] = [
  "super_admin",
  "school_admin",
  "principal",
  "teacher",
  "accountant",
  "hr",
  "hr_staff",
  "hod",
  "librarian",
  "transport_manager",
  "hostel_manager",
  "parent",
  "student",
];

function parseRole(value: string | null | undefined): Role | null {
  return value && (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

/**
 * Dev-only role override. Without a login screen there is otherwise no way to
 * exercise (or demonstrate) the permission matrix. Reads `x-dev-role` or the
 * `dev-role` cookie, and is hard-disabled outside development so it can never
 * become a production privilege-escalation hole.
 */
async function readDevRoleOverride(): Promise<Role | null> {
  if (process.env.NODE_ENV === "production") return null;
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  return parseRole(headerList.get(DEV_ROLE_HEADER)) ?? parseRole(cookieStore.get(DEV_ROLE_COOKIE)?.value);
}

export async function getCurrentUser(): Promise<RequestUser> {
  const schoolId = await getCurrentSchoolId();

  const [membership, devRole] = await Promise.all([
    prisma.schoolMembership.findFirst({
      where: { schoolId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    readDevRoleOverride(),
  ]);

  return {
    id: membership?.user.id ?? null,
    name: membership?.user.name ?? "System",
    // Falls back to school_admin only when the school has no membership rows at
    // all, so a freshly seeded database is still usable.
    role: devRole ?? parseRole(membership?.role) ?? "school_admin",
    schoolId,
  };
}
