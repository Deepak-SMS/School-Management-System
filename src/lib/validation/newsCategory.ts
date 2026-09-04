import { z } from "zod";
import { ACTIVE_STATUSES } from "@/lib/constants/school";

export const newsCategoryInputSchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(100),
  code: z.string().trim().min(1, "Category code is required").max(30),
  colorHex: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^#[0-9a-fA-F]{6}$/.test(v), "Must be a hex color like #2563eb"),
  status: z.enum(ACTIVE_STATUSES).default("active"),
});

export type NewsCategoryInput = z.infer<typeof newsCategoryInputSchema>;
