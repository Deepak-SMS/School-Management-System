import { z } from "zod";

/** The full set the DesignElement.type column has ever been given — see prisma/schema.prisma. Only a subset (see the designer's "Add" toolbar) is offered as a quick-add action; the rest stay valid for existing/system template data. */
export const designElementCreateSchema = z.object({
  templateId: z.string().min(1),
  side: z.enum(["front", "back"]).default("front"),
  type: z.enum(["text", "image", "photo", "logo", "shape", "line", "qrcode", "barcode", "signature", "dynamic_field"]),
  fieldKey: z.string().trim().max(100).optional(),
  content: z.string().trim().max(500).optional(),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(0.1),
  height: z.number().min(0.1),
});

export type DesignElementCreate = z.infer<typeof designElementCreateSchema>;

export const designElementUpdateSchema = z.object({
  fieldKey: z.string().trim().max(100).nullable().optional(),
  content: z.string().trim().max(500).optional(),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(0.1),
  height: z.number().min(0.1),
  rotation: z.number().optional(),
  fontSize: z.number().min(1).max(40).optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  color: z.string().trim().max(20).optional(),
  backgroundColor: z.string().trim().max(20).optional(),
  zIndex: z.number().int().optional(),
});

export type DesignElementUpdate = z.infer<typeof designElementUpdateSchema>;
