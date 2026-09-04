import type { ClassMappingInput, StudentOverrideInput } from "@/lib/validation/promotion";
import type { ApiError } from "@/services/studentService";

export interface PromotionPreviewStudent {
  id: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: string | null;
  sectionId: string | null;
  sectionName: string | null;
}

export interface PromotionPreviewClass {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  campusId: string;
  studentCount: number;
  suggestedAction: "promote" | "retain" | "exit";
  suggestedTargetClassId: string | null;
  students: PromotionPreviewStudent[];
}

export interface PromotionTargetClass {
  id: string;
  name: string;
  sortOrder: number;
  campusId: string;
  sections: { id: string; name: string }[];
}

export interface PromotionPreviewResponse {
  sourceYear: { id: string; label: string };
  targetYear: { id: string; label: string };
  targetClasses: PromotionTargetClass[];
  classes: PromotionPreviewClass[];
}

export interface PromotionCommitResult {
  promoted: number;
  retained: number;
  exited: number;
  total: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const promotionService = {
  async preview(sourceAcademicYearId: string, targetAcademicYearId: string): Promise<PromotionPreviewResponse> {
    const query = new URLSearchParams({ sourceAcademicYearId, targetAcademicYearId });
    const response = await fetch(`/api/students/promotion/preview?${query.toString()}`);
    return parseOrThrow<PromotionPreviewResponse>(response);
  },

  async commit(input: {
    sourceAcademicYearId: string;
    targetAcademicYearId: string;
    classMappings: ClassMappingInput[];
    studentOverrides: StudentOverrideInput[];
  }): Promise<PromotionCommitResult> {
    const response = await fetch("/api/students/promotion/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<PromotionCommitResult>(response);
  },
};
