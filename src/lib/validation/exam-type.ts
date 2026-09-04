import { z } from "zod";
import { ACTIVE_STATUSES } from "@/lib/constants/school";
import { EXAM_CATEGORIES } from "@/lib/constants/exam";

export const examTypeInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  code: z.string().trim().min(1, "Code is required").max(30),
  examCategory: z.enum(EXAM_CATEGORIES).default("summative"),
  sortOrder: z.coerce.number().int().default(0),
  status: z.enum(ACTIVE_STATUSES).default("active"),
});

export type ExamTypeInput = z.infer<typeof examTypeInputSchema>;
