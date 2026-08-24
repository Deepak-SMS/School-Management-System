import type { ApiError } from "@/services/studentService";
import type {
  VacancyInput,
  CandidateInput,
  ApplicationInput,
  InterviewInput,
  OfferInput,
  ConversionInput,
} from "@/lib/validation/recruitment";
import type { ApplicationStatus } from "@/lib/constants/hr";

/** Shapes returned by the recruitment APIs. Dates arrive as ISO strings. */

export interface VacancyRecord {
  id: string;
  code: string;
  title: string;
  departmentId?: string | null;
  designationId?: string | null;
  campusId?: string | null;
  employeeType?: { id: string; name: string } | null;
  hiringManager?: { id: string; fullName: string } | null;
  positionsCount: number;
  salaryRangeMin?: number | null;
  salaryRangeMax?: number | null;
  requiredQualification?: string | null;
  requiredExperienceYears?: number | null;
  skills?: string[];
  description?: string | null;
  responsibilities?: string | null;
  openingDate?: string | null;
  closingDate?: string | null;
  status: string;
  counts?: { applications: number; shortlisted: number; interview: number; selected: number; joined: number };
  createdAt: string;
}

export interface CandidateRecord {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  currentOrganization?: string | null;
  currentDesignation?: string | null;
  totalExperienceYears?: number | null;
  noticePeriodDays?: number | null;
  expectedSalary?: number | null;
  highestQualification?: string | null;
  university?: string | null;
  passingYear?: number | null;
  source?: string | null;
  resumeFileId?: string | null;
  convertedStaffId?: string | null;
  convertedStaff?: { id: string; employeeId: string; fullName: string } | null;
  applications: {
    id: string;
    status: string;
    vacancyId: string;
    vacancy?: { title: string; code: string };
  }[];
  createdAt: string;
}

export interface ApplicationRecord {
  id: string;
  status: string;
  appliedDate: string;
  source?: string | null;
  screeningScore?: number | null;
  screeningComments?: string | null;
  proposedSalary?: number | null;
  proposedJoiningDate?: string | null;
  candidate: { id: string; firstName: string; lastName?: string | null; email?: string | null; phone?: string | null };
  vacancy: { id: string; title: string; code: string };
  _count?: { interviews: number; offers: number };
}

export interface InterviewRecord {
  id: string;
  roundNumber: number;
  roundName?: string | null;
  scheduledAt: string;
  durationMinutes?: number | null;
  mode: string;
  location?: string | null;
  meetingLink?: string | null;
  status: string;
  outcome?: string | null;
  overallScore?: number | null;
  application: {
    id: string;
    status: string;
    candidate: { id: string; firstName: string; lastName?: string | null };
    vacancy: { id: string; title: string; code: string };
  };
  panel: { id: string; staffId: string; panelRole?: string | null; staff: { id: string; fullName: string } }[];
  evaluations: { id: string; evaluatorStaffId: string; recommendation?: string | null; overallScore?: number | null }[];
}

export interface OfferRecord {
  id: string;
  code?: string | null;
  status: string;
  salaryAmount?: number | null;
  joiningDate?: string | null;
  expiryDate?: string | null;
  sentAt?: string | null;
  respondedAt?: string | null;
  application: {
    id: string;
    status: string;
    candidate: { id: string; firstName: string; lastName?: string | null; email?: string | null };
    vacancy: { id: string; title: string; code: string };
  };
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

function toQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    query.set(key, String(value));
  }
  return query.toString();
}

async function send<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  return parseOrThrow<T>(
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  );
}

export const vacancyService = {
  async list(params: { q?: string; status?: string; departmentId?: string; page?: number; pageSize?: number } = {}) {
    return parseOrThrow<{ data: VacancyRecord[]; total: number; page: number; pageSize: number }>(
      await fetch(`/api/vacancies?${toQuery(params)}`),
    );
  },
  async get(id: string) {
    return parseOrThrow<VacancyRecord & { applications: ApplicationRecord[] }>(await fetch(`/api/vacancies/${id}`));
  },
  async create(input: VacancyInput) {
    return send<VacancyRecord>("/api/vacancies", input);
  },
  async update(id: string, input: Partial<VacancyInput>) {
    return send<VacancyRecord>(`/api/vacancies/${id}`, input, "PATCH");
  },
  async remove(id: string) {
    return parseOrThrow<{ success: boolean; closed: boolean; applications: number }>(
      await fetch(`/api/vacancies/${id}`, { method: "DELETE" }),
    );
  },
};

export const candidateService = {
  async list(params: { q?: string; stage?: string; vacancyId?: string; source?: string; page?: number; pageSize?: number } = {}) {
    return parseOrThrow<{ data: CandidateRecord[]; total: number; page: number; pageSize: number }>(
      await fetch(`/api/candidates?${toQuery(params)}`),
    );
  },
  async create(input: CandidateInput) {
    return send<CandidateRecord>("/api/candidates", input);
  },
};

export const applicationService = {
  async list(params: { q?: string; status?: string; vacancyId?: string; page?: number; pageSize?: number } = {}) {
    return parseOrThrow<{ data: ApplicationRecord[]; total: number; page: number; pageSize: number }>(
      await fetch(`/api/applications?${toQuery(params)}`),
    );
  },
  async create(input: ApplicationInput) {
    return send<ApplicationRecord>("/api/applications", input);
  },
  /** Moves the application along the pipeline; the server enforces legal transitions. */
  async setStage(id: string, input: { status: ApplicationStatus; note?: string; rejectionReason?: string } & Record<string, unknown>) {
    return send<ApplicationRecord & { message: string }>(`/api/applications/${id}/stage`, input);
  },
  async screen(id: string, input: { outcome: "shortlisted" | "rejected" | "hold"; screeningScore?: number; screeningComments?: string; rejectionReason?: string }) {
    return send<ApplicationRecord>(`/api/applications/${id}/stage`, input);
  },
  async convert(id: string, input: ConversionInput = {}) {
    return send<{ success: boolean; staffId: string; employeeId: string; fullName: string }>(
      `/api/applications/${id}/convert`,
      input,
    );
  },
};

export const interviewService = {
  async list(params: { status?: string; applicationId?: string; from?: string; to?: string } = {}) {
    return parseOrThrow<{ data: InterviewRecord[]; total: number }>(await fetch(`/api/interviews?${toQuery(params)}`));
  },
  async schedule(input: InterviewInput) {
    return send<InterviewRecord>("/api/interviews", input);
  },
  async evaluate(
    id: string,
    input: { scores?: Record<string, number>; overallScore?: number; recommendation: string; comments?: string },
  ) {
    return send<{ id: string; recommendation: string }>(`/api/interviews/${id}/evaluate`, input);
  },
};

export const offerService = {
  async list(params: { status?: string } = {}) {
    return parseOrThrow<{ data: OfferRecord[]; total: number }>(await fetch(`/api/offers?${toQuery(params)}`));
  },
  async create(input: OfferInput) {
    return send<OfferRecord>("/api/offers", input);
  },
  async setStatus(id: string, status: string, note?: string) {
    return send<OfferRecord>(`/api/offers/${id}`, { status, note }, "PATCH");
  },
};
