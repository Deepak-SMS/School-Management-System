import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export interface StudentEmailHistoryRecord {
  id: string;
  subject: string;
  status: string;
  sentAt: string | null;
  queuedAt: string;
  campaign: { name: string } | null;
}

export const emailHistoryService = {
  async forStudent(studentId: string): Promise<{ data: StudentEmailHistoryRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/email/history/student/${studentId}`));
  },
};
