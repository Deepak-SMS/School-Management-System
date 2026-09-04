import { z } from "zod";
import { COMMUNICATION_TYPE_VALUES, COMMUNICATION_TONE_VALUES } from "@/lib/ai/communication/templates";
import { AUDIENCE_MODE_VALUES } from "@/lib/ai/communication/audience-modes";

const audienceParamsShape = {
  audienceMode: z.enum(AUDIENCE_MODE_VALUES),
  classId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  thresholdPct: z.coerce.number().int().min(1).max(100).optional(),
};

export const aiCommunicationGenerateSchema = z.object({
  type: z.enum(COMMUNICATION_TYPE_VALUES),
  tone: z.enum(COMMUNICATION_TONE_VALUES),
  language: z.string().trim().min(1).max(40),
  context: z.string().trim().max(2000).optional().default(""),
  ...audienceParamsShape,
});

export type AiCommunicationGenerateInput = z.infer<typeof aiCommunicationGenerateSchema>;

export const aiCommunicationSendSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: z.string().trim().min(1, "Message body is required").max(10000),
  ...audienceParamsShape,
});

export type AiCommunicationSendInput = z.infer<typeof aiCommunicationSendSchema>;
