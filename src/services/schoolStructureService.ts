import type { SchoolStructure } from "@/types/student";

export const schoolStructureService = {
  async get(): Promise<SchoolStructure> {
    const response = await fetch("/api/school-structure");
    if (!response.ok) throw new Error("Failed to load school structure");
    return response.json();
  },
};
