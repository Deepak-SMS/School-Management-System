import "server-only";
import { prisma } from "@/lib/db";
import type { SchoolDetail } from "@/types/platform";

/** Thrown when deleting a school would silently discard real tenant data. */
export class SchoolHasDataError extends Error {
  constructor() {
    super("This school has students or staff on record and can't be deleted. Set its status to Cancelled instead.");
    this.name = "SchoolHasDataError";
  }
}

/** Shared by the school detail API route and the school detail page (server component). */
export async function loadSchoolDetail(id: string): Promise<SchoolDetail | null> {
  const school = await prisma.school.findUnique({
    where: { id },
    include: {
      memberships: {
        where: { role: "school_admin" },
        take: 1,
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { students: true, staff: true } },
    },
  });
  if (!school) return null;

  return {
    id: school.id,
    name: school.name,
    shortName: school.shortName,
    slug: school.slug,
    city: school.city,
    address: school.address,
    state: school.state,
    country: school.country,
    phone: school.phone,
    email: school.email,
    status: school.status,
    plan: school.plan,
    admin: school.memberships[0]?.user ?? null,
    studentCount: school._count.students,
    staffCount: school._count.staff,
    enabledModules: school.enabledModulesJson ? JSON.parse(school.enabledModulesJson) : null,
    createdAt: school.createdAt.toISOString(),
  };
}
