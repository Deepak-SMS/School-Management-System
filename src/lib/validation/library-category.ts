import { z } from "zod";

export const libraryCategoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  parentId: z.string().trim().min(1).optional(),
});

export type LibraryCategoryInput = z.infer<typeof libraryCategoryInputSchema>;
