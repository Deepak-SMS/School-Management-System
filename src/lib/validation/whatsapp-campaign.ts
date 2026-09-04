import { z } from "zod";
import { WHATSAPP_AUDIENCE_MODE_VALUES } from "@/lib/whatsapp/audience-modes";

const audienceParamsShape = {
  audienceMode: z.enum(WHATSAPP_AUDIENCE_MODE_VALUES),
  classId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  thresholdPct: z.coerce.number().int().min(1).max(100).optional(),
  tag: z.string().trim().min(1).optional(),
  contactIds: z.array(z.string().min(1)).optional(),
};

export const whatsappCampaignCreateSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required").max(200),
  templateId: z.string().min(1).optional(),
  messageBody: z.string().trim().min(1, "Message is required").max(4096),
  ...audienceParamsShape,
});
export type WhatsAppCampaignCreateInput = z.infer<typeof whatsappCampaignCreateSchema>;

export const whatsappCampaignUpdateSchema = whatsappCampaignCreateSchema.partial();
