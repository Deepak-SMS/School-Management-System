import type { NewsCategoryInput } from "@/lib/validation/newsCategory";
import type { NewsCategoryListResponse, NewsCategoryRecord } from "@/types/newsCategory";
import type { ApiError } from "@/services/studentService";

export interface NewsCategoryListParams {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const newsCategoryService = {
  async list(params: NewsCategoryListParams = {}): Promise<NewsCategoryListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/news-categories?${query.toString()}`);
    return parseOrThrow<NewsCategoryListResponse>(response);
  },

  async create(input: NewsCategoryInput): Promise<NewsCategoryRecord> {
    const response = await fetch("/api/news-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<NewsCategoryRecord>(response);
  },

  async update(id: string, input: Partial<NewsCategoryInput>): Promise<NewsCategoryRecord> {
    const response = await fetch(`/api/news-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<NewsCategoryRecord>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/news-categories/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },
};
