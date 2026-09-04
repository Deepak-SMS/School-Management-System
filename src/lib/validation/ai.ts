import { z } from "zod";

export const aiChatInputSchema = z
  .object({
    conversationId: z.string().min(1).optional(),
    message: z.string().trim().min(1, "Message is required").max(4000, "Message is too long").optional(),
    regenerate: z.boolean().optional(),
  })
  .refine((data) => (data.regenerate ? Boolean(data.conversationId) : Boolean(data.message)), {
    message: "A message is required (or set regenerate with an existing conversationId)",
    path: ["message"],
  });

export type AiChatInput = z.infer<typeof aiChatInputSchema>;
