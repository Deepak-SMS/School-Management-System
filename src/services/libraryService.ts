import type { ApiError } from "@/services/studentService";
import type { LibraryCategoryInput } from "@/lib/validation/library-category";
import type { LibrarySettingsInput } from "@/lib/validation/library-settings";
import type { LibraryBookInput } from "@/lib/validation/library-book";
import type { LibraryBookCopyCreateInput, LibraryBookCopyUpdateInput } from "@/lib/validation/library-book-copy";
import type {
  LibraryCategoryRecord,
  LibrarySettingsRecord,
  LibraryBookRecord,
  LibraryBookDetailRecord,
  LibraryBookCopyRecord,
  LibraryStatsRecord,
} from "@/types/library";

/**
 * Library service layer. UI never calls `fetch` directly — it goes through
 * these, so swapping transport later is a change in one file (CLAUDE.md).
 */

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

async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOrThrow<T>(response);
}

export const libraryCategoryService = {
  async list(): Promise<{ data: LibraryCategoryRecord[]; total: number }> {
    return parseOrThrow(await fetch("/api/library-categories"));
  },
  async create(input: LibraryCategoryInput): Promise<LibraryCategoryRecord> {
    return postJson("/api/library-categories", input);
  },
  async update(id: string, input: Partial<LibraryCategoryInput>): Promise<LibraryCategoryRecord> {
    return postJson(`/api/library-categories/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/library-categories/${id}`, { method: "DELETE" }));
  },
};

export const librarySettingsService = {
  async get(): Promise<LibrarySettingsRecord> {
    return parseOrThrow(await fetch("/api/library-settings"));
  },
  async update(input: LibrarySettingsInput): Promise<LibrarySettingsRecord> {
    return postJson("/api/library-settings", input, "PATCH");
  },
};

export const libraryStatsService = {
  async get(): Promise<LibraryStatsRecord> {
    return parseOrThrow(await fetch("/api/library/stats"));
  },
};

export const libraryBookService = {
  async list(
    params: {
      q?: string;
      categoryId?: string;
      subjectId?: string;
      language?: string;
      availableOnly?: boolean;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{ data: LibraryBookRecord[]; total: number; page: number; pageSize: number }> {
    return parseOrThrow(await fetch(`/api/library-books?${toQuery(params)}`));
  },
  async get(id: string): Promise<LibraryBookDetailRecord> {
    return parseOrThrow(await fetch(`/api/library-books/${id}`));
  },
  async create(input: LibraryBookInput): Promise<LibraryBookRecord> {
    return postJson("/api/library-books", input);
  },
  async update(id: string, input: Partial<LibraryBookInput>): Promise<LibraryBookRecord> {
    return postJson(`/api/library-books/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<{ success: boolean; deactivated: boolean; copies: number }> {
    return parseOrThrow(await fetch(`/api/library-books/${id}`, { method: "DELETE" }));
  },
};

export const libraryBookCopyService = {
  async list(bookId: string): Promise<{ data: LibraryBookCopyRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/library-books/${bookId}/copies`));
  },
  async create(bookId: string, input: LibraryBookCopyCreateInput): Promise<{ data: LibraryBookCopyRecord[]; total: number }> {
    return postJson(`/api/library-books/${bookId}/copies`, input);
  },
  async update(id: string, input: LibraryBookCopyUpdateInput): Promise<LibraryBookCopyRecord> {
    return postJson(`/api/library-book-copies/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/library-book-copies/${id}`, { method: "DELETE" }));
  },
};
