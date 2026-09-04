/** Shapes returned by the /api/platform/* routes — dates arrive as ISO strings over JSON. */

export interface SchoolAdminRef {
  id: string;
  name: string;
  email: string;
}

export interface SchoolSummary {
  id: string;
  name: string;
  shortName: string;
  /** URL-safe id used in this school's branded login link (/{slug}/admin). Null for schools created before this existed. */
  slug: string | null;
  city?: string | null;
  status: string;
  plan: string;
  admin: SchoolAdminRef | null;
  studentCount: number;
  createdAt: string;
}

export interface SchoolDetail extends SchoolSummary {
  address?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  staffCount: number;
  enabledModules: string[] | null;
}

export interface SchoolListResponse {
  data: SchoolSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatedSchoolAdmin {
  name: string;
  email: string;
  temporaryPassword: string;
}

export interface CreateSchoolResult {
  school: SchoolDetail;
  admin: CreatedSchoolAdmin;
}

export interface PlatformAuditLogEntry {
  id: string;
  action: string;
  actor: { id: string; name: string };
  targetSchool: { id: string; name: string } | null;
  metadata: unknown;
  createdAt: string;
}

export interface PlatformAuditLogResponse {
  data: PlatformAuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}
