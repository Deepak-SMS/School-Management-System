import { z } from "zod";

/**
 * A certificate type is per-school (system types have `schoolId = null` and are
 * shared, read-only starting points — same pattern as IDCardTemplate). `key` is
 * a stable slug used by seed data and never shown to the user; `numberingPrefix`
 * is what appears in the certificate number, e.g. "TC" in `TC/2026/00045`.
 */
export const certificateTypeInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key is required")
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only"),
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.enum(["student", "staff"]),
  numberingPrefix: z
    .string()
    .trim()
    .min(1, "Prefix is required")
    .max(15)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, or hyphen only")
    .transform((v) => v.toUpperCase()),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type CertificateTypeInput = z.infer<typeof certificateTypeInputSchema>;

export const CERTIFICATE_TYPE_DEFAULTS = { requiresApproval: false, isActive: true };

export const generateCertificateInputSchema = z.object({
  certificateTypeId: z.string().min(1),
  templateId: z.string().min(1),
  studentId: z.string().optional(),
  staffId: z.string().optional(),
});
