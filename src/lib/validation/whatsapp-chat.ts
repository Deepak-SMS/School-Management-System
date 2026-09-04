import { z } from "zod";

export const whatsappChatSendSchema = z.object({
  text: z.string().trim().min(1, "Message is required").max(4096),
});
