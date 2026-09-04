import { z } from "zod";

export const aiAnalyticsRequestSchema = z.object({
  section: z.enum(["attendance", "fees"]),
  academicYearId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  thresholdPct: z.coerce.number().int().min(1).max(100).optional(),
});

export type AiAnalyticsRequest = z.infer<typeof aiAnalyticsRequestSchema>;
