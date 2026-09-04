import type { NewsInput } from "@/lib/validation/news";
import type { NewsCommentInput } from "@/lib/validation/newsComment";
import type { NewsCommentRecord, NewsDashboardStats, NewsListResponse, NewsRecord } from "@/types/news";
import type { ApiError } from "@/services/studentService";

export interface NewsListParams {
  q?: string;
  status?: string;
  categoryId?: string;
  priority?: string;
  audienceType?: string;
  page?: number;
  pageSize?: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const newsService = {
  async list(params: NewsListParams = {}): Promise<NewsListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.categoryId) query.set("categoryId", params.categoryId);
    if (params.priority) query.set("priority", params.priority);
    if (params.audienceType) query.set("audienceType", params.audienceType);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/news?${query.toString()}`);
    return parseOrThrow<NewsListResponse>(response);
  },

  async stats(): Promise<NewsDashboardStats> {
    const response = await fetch("/api/news/stats");
    return parseOrThrow<NewsDashboardStats>(response);
  },

  async get(id: string): Promise<NewsRecord> {
    const response = await fetch(`/api/news/${id}`);
    return parseOrThrow<NewsRecord>(response);
  },

  async create(input: NewsInput): Promise<NewsRecord> {
    const response = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<NewsRecord>(response);
  },

  async update(id: string, input: Partial<NewsInput>): Promise<NewsRecord> {
    const response = await fetch(`/api/news/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<NewsRecord>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/news/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },

  async publish(id: string): Promise<NewsRecord> {
    const response = await fetch(`/api/news/${id}/publish`, { method: "POST" });
    return parseOrThrow<NewsRecord>(response);
  },

  async recordView(id: string): Promise<void> {
    await fetch(`/api/news/${id}/view`, { method: "POST" });
  },

  async listComments(id: string): Promise<{ data: NewsCommentRecord[] }> {
    const response = await fetch(`/api/news/${id}/comments`);
    return parseOrThrow(response);
  },

  async addComment(id: string, input: NewsCommentInput): Promise<NewsCommentRecord> {
    const response = await fetch(`/api/news/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<NewsCommentRecord>(response);
  },

  async setCommentStatus(id: string, commentId: string, status: "visible" | "hidden"): Promise<NewsCommentRecord> {
    const response = await fetch(`/api/news/${id}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return parseOrThrow<NewsCommentRecord>(response);
  },

  async removeComment(id: string, commentId: string): Promise<void> {
    const response = await fetch(`/api/news/${id}/comments/${commentId}`, { method: "DELETE" });
    await parseOrThrow(response);
  },
};
