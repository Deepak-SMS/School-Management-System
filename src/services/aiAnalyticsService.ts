import type { AiAnalyticsResponse } from "@/types/ai-analytics";
import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export interface AnalyticsQuery {
  section: "attendance" | "fees";
  classId?: string;
  sectionId?: string;
  academicYearId?: string;
  from?: string;
  to?: string;
  thresholdPct?: number;
}

export const aiAnalyticsService = {
  async fetch(query: AnalyticsQuery): Promise<AiAnalyticsResponse> {
    const response = await fetch("/api/ai/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });
    return parseOrThrow<AiAnalyticsResponse>(response);
  },
};
