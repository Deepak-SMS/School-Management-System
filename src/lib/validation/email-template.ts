import { z } from "zod";

export const EMAIL_TEMPLATE_CATEGORY_VALUES = ["fee", "attendance", "exam", "result", "ptm", "homework", "announcement", "holiday", "general", "custom"] as const;

export const emailTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(500).optional(),
  category: z.enum(EMAIL_TEMPLATE_CATEGORY_VALUES).default("general"),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  bodyHtml: z.string().trim().min(1, "Message body is required").max(20000),
  isActive: z.boolean().optional().default(true),
});
export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;

export const emailTemplatePreviewSchema = z.object({
  studentId: z.string().min(1).optional(),
  sampleValues: z.record(z.string(), z.string()).optional().default({}),
});
