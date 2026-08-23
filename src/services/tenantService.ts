import type { School } from "@/types/tenant";
import { mockSchools } from "@/lib/mock-data/tenants";

/**
 * Service boundary for tenant (school/campus/academic year) data.
 *
 * UI code should depend on this interface, never on `mockSchools` directly,
 * so swapping the mock implementation for real API calls later is a
 * one-file change. See CLAUDE.md for the API-ready-frontend convention
 * used across all `*Service` modules.
 */
export interface TenantService {
  listSchoolsForUser(userId: string): Promise<School[]>;
  getSchool(schoolId: string): Promise<School | undefined>;
}

class MockTenantService implements TenantService {
  async listSchoolsForUser(): Promise<School[]> {
    return mockSchools;
  }

  async getSchool(schoolId: string): Promise<School | undefined> {
    return mockSchools.find((school) => school.id === schoolId);
  }
}

export const tenantService: TenantService = new MockTenantService();
