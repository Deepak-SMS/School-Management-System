import { z } from "zod";

export const certificateTemplateCreateSchema = z.object({
  certificateTypeId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(150),
  pageWidthMm: z.number().min(50).max(1000).default(210),
  pageHeightMm: z.number().min(50).max(1000).default(297),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
});

export type CertificateTemplateCreateInput = z.infer<typeof certificateTemplateCreateSchema>;

export const certificateTemplateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  backgroundImageUrl: z.string().trim().max(500).nullable().optional(),
  pageWidthMm: z.number().min(50).max(1000).optional(),
  pageHeightMm: z.number().min(50).max(1000).optional(),
  orientation: z.enum(["portrait", "landscape"]).optional(),
  isActive: z.boolean().optional(),
});

export type CertificateTemplateUpdate = z.infer<typeof certificateTemplateUpdateSchema>;
