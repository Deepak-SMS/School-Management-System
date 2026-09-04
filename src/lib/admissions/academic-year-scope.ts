import { prisma } from "@/lib/db";

/**
 * Resolves which academic year an admissions view is scoped to: the requested
 * one if given, else the active year, else the most recent. Shared by the
 * overview and reports endpoints so "which year are we looking at" is decided
 * the same way in both places.
 */
export async function resolveScopedAcademicYear(schoolId: string, requestedYearId: string | null) {
  if (requestedYearId) {
    return prisma.academicYear.findFirst({ where: { id: requestedYearId, schoolId } });
  }
  return (
    (await prisma.academicYear.findFirst({ where: { schoolId, status: "active" } })) ??
    (await prisma.academicYear.findFirst({ where: { schoolId }, orderBy: { startDate: "desc" } }))
  );
}
