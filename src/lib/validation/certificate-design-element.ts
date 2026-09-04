import { z } from "zod";

/**
 * Certificate-only design element validation — deliberately separate from
 * src/lib/validation/design-element.ts (shared with ID card DesignElement,
 * which has no imageUrl/border/opacity columns; reusing that schema here
 * would let those fields reach a Prisma update() the ID card model rejects).
 */

const ELEMENT_TYPES = ["text", "dynamic_field", "image", "logo", "shape", "line", "qrcode", "barcode", "signature"] as const;

export const certificateDesignElementCreateSchema = z.object({
  templateId: z.string().min(1),
  side: z.enum(["front", "back"]).default("front"),
  type: z.enum(ELEMENT_TYPES),
  fieldKey: z.string().trim().max(100).optional(),
  content: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  x: z.number().min(0).default(10),
  y: z.number().min(0).default(10),
  width: z.number().min(0.1).default(50),
  height: z.number().min(0.1).default(15),
});

export type CertificateDesignElementCreateInput = z.infer<typeof certificateDesignElementCreateSchema>;

export const certificateDesignElementUpdateSchema = z.object({
  fieldKey: z.string().trim().max(100).nullable().optional(),
  content: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  x: z.number().min(0).optional(),
  y: z.number().min(0).optional(),
  width: z.number().min(0.1).optional(),
  height: z.number().min(0.1).optional(),
  rotation: z.number().optional(),
  fontSize: z.number().min(1).max(60).optional(),
  fontFamily: z.string().trim().max(60).optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().min(0.5).max(4).optional(),
  color: z.string().trim().max(20).optional(),
  backgroundColor: z.string().trim().max(20).optional(),
  borderWidth: z.number().min(0).max(20).nullable().optional(),
  borderColor: z.string().trim().max(20).nullable().optional(),
  borderStyle: z.enum(["solid", "dashed", "double"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
  zIndex: z.number().int().optional(),
});

export type CertificateDesignElementUpdate = z.infer<typeof certificateDesignElementUpdateSchema>;
