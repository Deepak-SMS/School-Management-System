import { prisma } from "@/lib/db";

/**
 * Pre-auth placeholder for "which school is this request for".
 *
 * There is no login/session yet, so every API route resolves the single
 * seeded demo school. Once auth ships, replace the body of this function
 * with `session.schoolId` (or the active membership) from the authenticated
 * request — every query in the codebase already filters by the value this
 * returns, so that's the only change needed for real tenant isolation.
 *
 * Never accept a school id from client-supplied input (query string, body,
 * header) as the source of truth here — that would let any client read
 * another school's data.
 */
export async function getCurrentSchoolId(): Promise<string> {
  const school = await prisma.school.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  return school.id;
}
