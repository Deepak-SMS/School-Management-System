import type { AdmissionEnquiryInput } from "@/lib/validation/admission-enquiry";

export interface AdmissionEnquiryRecord {
  id: string;
  schoolId: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string | null;
  childName: string;
  childDob: string | null;
  interestedClassId: string | null;
  source: string;
  status: string;
  followUpDate: string | null;
  assignedToId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  interestedClass: { id: string; name: string } | null;
  assignedTo: { id: string; fullName: string } | null;
}

export interface AdmissionEnquiryListParams {
  status?: string;
  source?: string;
  assignedToId?: string;
  q?: string;
}

export interface GenerateLinkResponse {
  token: string;
  url: string;
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

export const admissionEnquiryService = {
  async list(params: AdmissionEnquiryListParams = {}): Promise<{ data: AdmissionEnquiryRecord[]; total: number }> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.source) query.set("source", params.source);
    if (params.assignedToId) query.set("assignedToId", params.assignedToId);
    if (params.q) query.set("q", params.q);

    const response = await fetch(`/api/admission-enquiries?${query.toString()}`);
    return parseOrThrow(response);
  },

  async get(id: string): Promise<AdmissionEnquiryRecord> {
    const response = await fetch(`/api/admission-enquiries/${id}`);
    return parseOrThrow(response);
  },

  async create(input: AdmissionEnquiryInput): Promise<AdmissionEnquiryRecord> {
    const response = await fetch("/api/admission-enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow(response);
  },

  async update(id: string, input: Partial<AdmissionEnquiryInput>): Promise<AdmissionEnquiryRecord> {
    const response = await fetch(`/api/admission-enquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/admission-enquiries/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },

  async generateLink(id: string): Promise<GenerateLinkResponse> {
    const response = await fetch(`/api/admission-enquiries/${id}/generate-link`, { method: "POST" });
    return parseOrThrow(response);
  },
};
