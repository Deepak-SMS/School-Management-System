import { z } from "zod";
import { EMAIL_RECIPIENT_TYPE_VALUES } from "@/lib/email-campaigns/recipient-types";

const audienceParamsShape = {
  recipientType: z.enum(EMAIL_RECIPIENT_TYPE_VALUES),
  studentIds: z.array(z.string().min(1)).optional(),
  classIds: z.array(z.string().min(1)).optional(),
  sectionIds: z.array(z.string().min(1)).optional(),
  minPendingAmount: z.coerce.number().min(0).optional(),
};

export const emailCampaignCreateSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required").max(200),
  templateId: z.string().min(1).optional(),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  bodyHtml: z.string().trim().min(1, "Message is required").max(20000),
  importedRows: z
    .array(z.object({ name: z.string(), email: z.string(), customFields: z.record(z.string(), z.string()).optional().default({}) }))
    .optional(),
  ...audienceParamsShape,
});
export type EmailCampaignCreateInput = z.infer<typeof emailCampaignCreateSchema>;

export const emailCampaignUpdateSchema = emailCampaignCreateSchema.partial();

export const emailCampaignScheduleSchema = z.object({
  scheduledAt: z.string().datetime().or(z.string().min(1)),
});
