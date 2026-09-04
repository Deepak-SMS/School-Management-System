import type { StudentInput } from "@/lib/validation/student";
import type { APPLICATION_TRANSITION_STATUSES } from "@/lib/constants/admissions";

type ApplicationTransitionStatus = (typeof APPLICATION_TRANSITION_STATUSES)[number];

export interface StudentRegistrationListParams {
  status?: string;
  q?: string;
}

export interface StudentRegistrationRecord {
  id: string;
  schoolId: string;
  formId: string;
  status: string;
  studentName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  studentId: string | null;
  enquiryId: string | null;
  submittedAt: string;
  payload: Record<string, unknown> | null;
  form: { id: string; title: string };
  student: { id: string; admissionNumber: string } | null;
}

export interface StudentRegistrationListResponse {
  data: StudentRegistrationRecord[];
  pendingCount: number;
  total: number;
}

/** The full student record — same shape the "Add student" form submits, plus the reviewer's decision. */
export interface ReviewApproveInput extends StudentInput {
  action: "approve";
  reviewNote?: string;
}

export interface ReviewRejectInput {
  action: "reject";
  reviewNote: string;
}

export interface ReviewResponse {
  success: true;
  status: string;
  studentId?: string;
  admissionNumber?: string;
}

export interface AdmissionsOverview {
  counts: { pending: number; approved: number; rejected: number };
  admittedByClass: { classId: string; className: string; count: number }[];
}

export interface ApiError {
  error: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const studentRegistrationService = {
  async list(params: StudentRegistrationListParams = {}): Promise<StudentRegistrationListResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.q) query.set("q", params.q);

    const response = await fetch(`/api/student-registrations?${query.toString()}`);
    return parseOrThrow<StudentRegistrationListResponse>(response);
  },

  async review(id: string, input: ReviewApproveInput | ReviewRejectInput): Promise<ReviewResponse> {
    const response = await fetch(`/api/student-registrations/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<ReviewResponse>(response);
  },

  async overview(academicYearId?: string): Promise<AdmissionsOverview> {
    const query = new URLSearchParams();
    if (academicYearId) query.set("academicYearId", academicYearId);
    const response = await fetch(`/api/admissions/overview?${query.toString()}`);
    return parseOrThrow<AdmissionsOverview>(response);
  },

  /** Moves an application between in-progress statuses — never approve/reject, which go through `review`. */
  async setStatus(id: string, status: ApplicationTransitionStatus): Promise<ReviewResponse> {
    const response = await fetch(`/api/student-registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return parseOrThrow<ReviewResponse>(response);
  },
};
