import { z } from "zod";

export const designElementUpdateSchema = z.object({
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
});

export type DesignElementUpdate = z.infer<typeof designElementUpdateSchema>;
