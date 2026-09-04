import { z } from "zod";
import { isValidWhatsAppNumber } from "@/lib/whatsapp/phone";

export const whatsappContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.string().trim().refine(isValidWhatsAppNumber, "Enter a valid WhatsApp number"),
  tags: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  notes: z.string().trim().max(2000).optional(),
});
export type WhatsAppContactInput = z.infer<typeof whatsappContactSchema>;

export const whatsappContactOptOutSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const whatsappContactImportMappingSchema = z.object({
  nameColumn: z.string().trim().min(1),
  phoneColumn: z.string().trim().min(1),
  tagColumns: z.array(z.string().trim().min(1)).optional().default([]),
  customColumns: z.array(z.string().trim().min(1)).optional().default([]),
});
export type WhatsAppContactImportMappingInput = z.infer<typeof whatsappContactImportMappingSchema>;

export const whatsappContactImportCommitSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        phoneE164: z.string().trim().min(1),
        rawPhone: z.string().trim().optional().default(""),
        tags: z.array(z.string()).optional().default([]),
        customFields: z.record(z.string(), z.string()).optional().default({}),
      }),
    )
    .min(1, "No valid rows to import")
    .max(5000),
});
