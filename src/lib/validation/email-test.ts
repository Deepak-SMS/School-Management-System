import { z } from "zod";

export const emailCampaignTestSchema = z.object({
  to: z.string().trim().email("Enter a valid email address"),
  studentId: z.string().min(1).optional(),
});
