import type { School } from "@/types/tenant";
import type { ApiError } from "@/services/studentService";

/**
 * Service boundary for tenant (school/campus/academic year) data.
 *
 * UI code should depend on this interface, never fetch /api/tenant/* directly,
 * so the request shape stays a one-file change. See CLAUDE.md for the
 * API-ready-frontend convention used across all `*Service` modules.
 */
export interface TenantService {
  listSchoolsForUser(userId: string): Promise<School[]>;
  getSchool(schoolId: string): Promise<School | undefined>;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const tenantService: TenantService = {
  // userId is unused — the API resolves membership from the session, never
  // from client-supplied input (see src/lib/tenant.ts).
  async listSchoolsForUser(): Promise<School[]> {
    const response = await fetch("/api/tenant/schools");
    return parseOrThrow<School[]>(response);
  },

  async getSchool(schoolId: string): Promise<School | undefined> {
    const schools = await tenantService.listSchoolsForUser("");
    return schools.find((school) => school.id === schoolId);
  },
};
