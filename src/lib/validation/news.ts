import { z } from "zod";
import { NEWS_STATUSES, NEWS_PRIORITIES, NEWS_AUDIENCE_TYPES } from "@/lib/constants/news";

const optionalString = z.string().trim().max(255).optional();
const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date");

const audienceTargetSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().trim().optional(),
});

/** Base object (no refinements) — `.partial()` cannot be applied to a refined (ZodEffects) schema, so PATCH builds from this instead. */
export const newsBaseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  shortDescription: z.string().trim().max(500).optional(),
  contentHtml: z.string().trim().min(1, "Content is required"),
  categoryId: optionalString,
  featuredImageFileId: optionalString,
  priority: z.enum(NEWS_PRIORITIES).default("normal"),
  status: z.enum(NEWS_STATUSES).default("draft"),
  audienceType: z.enum(NEWS_AUDIENCE_TYPES).default("all"),
  audienceTargets: z.array(audienceTargetSchema).default([]),
  attachmentFileIds: z.array(z.string()).default([]),
  imageFileIds: z.array(z.string()).default([]),
  commentsEnabled: z.boolean().default(true),
  notifyInApp: z.boolean().default(true),
  publishAt: optionalDate,
  expiresAt: optionalDate,
  autoArchiveAfterExpiry: z.boolean().default(true),
  authorStaffId: optionalString,
});

function expiresAfterPublish(data: { publishAt?: string; expiresAt?: string }) {
  return !data.publishAt || !data.expiresAt || Date.parse(data.expiresAt) > Date.parse(data.publishAt);
}

export const newsInputSchema = newsBaseSchema.refine(expiresAfterPublish, {
  message: "Expiry must be after the publish date",
  path: ["expiresAt"],
});

/** For PATCH: publish/expiry dates are only compared when both are present in the same request. */
export const newsUpdateSchema = newsBaseSchema.partial().refine(
  (data) => data.publishAt === undefined || data.expiresAt === undefined || expiresAfterPublish(data as { publishAt: string; expiresAt: string }),
  { message: "Expiry must be after the publish date", path: ["expiresAt"] },
);

export type NewsInput = z.infer<typeof newsInputSchema>;
