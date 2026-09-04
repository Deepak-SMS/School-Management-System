import { z } from "zod";

export const WHATSAPP_TEMPLATE_CATEGORY_VALUES = ["fee_reminder", "attendance", "exam", "event", "admission", "general", "custom"] as const;

export const whatsappTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: z.enum(WHATSAPP_TEMPLATE_CATEGORY_VALUES).default("general"),
  bodyText: z.string().trim().min(1, "Message body is required").max(4096),
  isActive: z.boolean().optional().default(true),
});
export type WhatsAppTemplateInput = z.infer<typeof whatsappTemplateSchema>;

export const whatsappTemplatePreviewSchema = z.object({
  studentId: z.string().min(1).optional(),
  sampleValues: z.record(z.string(), z.string()).optional().default({}),
});
