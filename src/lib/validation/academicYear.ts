import { z } from "zod";
import { ACADEMIC_YEAR_STATUSES } from "@/lib/constants/school";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date");

/** Base object (no refinements) — `.partial()` cannot be applied to a refined (ZodEffects) schema, so PATCH routes build their schema from this instead of academicYearInputSchema. */
export const academicYearBaseSchema = z.object({
  label: z.string().trim().min(1, "Academic year name is required").max(50),
  startDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid start date"),
  endDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid end date"),
  admissionStartDate: optionalDate,
  admissionEndDate: optionalDate,
  promotionDate: optionalDate,
  resultPublicationDate: optionalDate,
  status: z.enum(ACADEMIC_YEAR_STATUSES).default("draft"),
});

function endDateAfterStartDate(data: { startDate: string; endDate: string }) {
  return Date.parse(data.endDate) > Date.parse(data.startDate);
}

export const academicYearInputSchema = academicYearBaseSchema.refine(endDateAfterStartDate, {
  message: "End date must be after the start date",
  path: ["endDate"],
});

/** For PATCH: both dates are only checked against each other when both are present in the same request. */
export const academicYearUpdateSchema = academicYearBaseSchema.partial().refine(
  (data) => data.startDate === undefined || data.endDate === undefined || endDateAfterStartDate({ startDate: data.startDate, endDate: data.endDate }),
  { message: "End date must be after the start date", path: ["endDate"] },
);

export type AcademicYearInput = z.infer<typeof academicYearInputSchema>;

export const copyConfigSchema = z.object({
  sourceAcademicYearId: z.string().min(1),
  copyClasses: z.boolean().default(true),
  copySections: z.boolean().default(true),
  copySubjects: z.boolean().default(true),
  copyTeacherAssignments: z.boolean().default(true),
});

export type CopyConfigInput = z.infer<typeof copyConfigSchema>;
