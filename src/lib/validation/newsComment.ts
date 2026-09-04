import { z } from "zod";
import { NEWS_COMMENT_STATUSES } from "@/lib/constants/news";

export const newsCommentInputSchema = z.object({
  authorName: z.string().trim().min(1, "Name is required").max(150),
  authorRole: z.string().trim().min(1).max(50),
  content: z.string().trim().min(1, "Comment can't be empty").max(2000),
});

export type NewsCommentInput = z.infer<typeof newsCommentInputSchema>;

export const newsCommentUpdateSchema = z.object({
  status: z.enum(NEWS_COMMENT_STATUSES),
});
