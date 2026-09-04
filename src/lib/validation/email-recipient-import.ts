import { z } from "zod";

export const emailRecipientImportMappingSchema = z.object({
  nameColumn: z.string().trim().min(1),
  emailColumn: z.string().trim().min(1),
  customColumns: z.array(z.string().trim().min(1)).optional().default([]),
});
export type EmailRecipientImportMappingInput = z.infer<typeof emailRecipientImportMappingSchema>;
