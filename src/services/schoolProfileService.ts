import type { SchoolProfileInput, SchoolProfileRecord } from "@/types/schoolProfile";
import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const schoolProfileService = {
  async get(): Promise<SchoolProfileRecord> {
    const response = await fetch("/api/school");
    return parseOrThrow<SchoolProfileRecord>(response);
  },

  async update(input: SchoolProfileInput): Promise<SchoolProfileRecord> {
    const response = await fetch("/api/school", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<SchoolProfileRecord>(response);
  },

  async uploadLogo(file: File): Promise<SchoolProfileRecord> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/school/logo", { method: "POST", body: formData });
    return parseOrThrow<SchoolProfileRecord>(response);
  },

  async removeLogo(): Promise<SchoolProfileRecord> {
    const response = await fetch("/api/school/logo", { method: "DELETE" });
    return parseOrThrow<SchoolProfileRecord>(response);
  },

  async uploadBanner(file: File): Promise<SchoolProfileRecord> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/school/banner", { method: "POST", body: formData });
    return parseOrThrow<SchoolProfileRecord>(response);
  },

  async removeBanner(): Promise<SchoolProfileRecord> {
    const response = await fetch("/api/school/banner", { method: "DELETE" });
    return parseOrThrow<SchoolProfileRecord>(response);
  },
};
