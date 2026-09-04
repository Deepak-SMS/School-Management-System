export interface AdmissionFunnelStep {
  label: string;
  count: number;
}

export interface AdmissionReportsResponse {
  academicYearId: string | null;
  funnel: AdmissionFunnelStep[];
  enquiries: {
    total: number;
    byStatus: { status: string; count: number }[];
    bySource: { source: string; count: number; converted: number }[];
    byCounsellor: { staffId: string; staffName: string; count: number; converted: number }[];
  };
  applications: {
    total: number;
    byStatus: { status: string; count: number }[];
  };
  admittedByClass: { classId: string; className: string; count: number }[];
}

export interface ApiError {
  error: string;
}

export const admissionReportsService = {
  async get(academicYearId?: string): Promise<AdmissionReportsResponse> {
    const query = new URLSearchParams();
    if (academicYearId) query.set("academicYearId", academicYearId);

    const response = await fetch(`/api/admissions/reports?${query.toString()}`);
    const body = await response.json();
    if (!response.ok) throw body as ApiError;
    return body as AdmissionReportsResponse;
  },
};
