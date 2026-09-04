import "server-only";
import { prisma } from "@/lib/db";

/**
 * The one deliberate place in the codebase that reads across every tenant
 * with no schoolId filter — gated by requireSuperAdmin() at the call site
 * (the (dashboard) layout), never exposed through a school-scoped route.
 */

export interface PlatformStats {
  totalSchools: number;
  activeSchools: number;
  trialSchools: number;
  totalStudents: number;
  totalStaff: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [totalSchools, activeSchools, trialSchools, totalStudents, totalStaff] = await Promise.all([
    prisma.school.count(),
    prisma.school.count({ where: { status: "active" } }),
    prisma.school.count({ where: { status: "trial" } }),
    prisma.student.count(),
    prisma.staff.count(),
  ]);

  return { totalSchools, activeSchools, trialSchools, totalStudents, totalStaff };
}
