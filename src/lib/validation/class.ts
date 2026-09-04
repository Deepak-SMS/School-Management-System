import { z } from "zod";
import { ACTIVE_STATUSES, GRADING_SYSTEMS } from "@/lib/constants/school";
import { optionalNumber } from "@/lib/validation/shared";

/** Enforced naming convention (spec: school wants every class named/coded the same predictable way, not free text). */
const CLASS_NAME_PATTERN = /^Class \d{1,2}$/;
/** e.g. "CLS01" for Class 1, "CLS12" for Class 12 — the default 1-12 classes created for every new school follow this exactly, see src/app/api/platform/schools/route.ts. */
const CLASS_CODE_PATTERN = /^CLS\d{2}$/;

export const classInputSchema = z.object({
  name: z.string().trim().regex(CLASS_NAME_PATTERN, 'Class name must be in the form "Class 10"'),
  code: z.string().trim().regex(CLASS_CODE_PATTERN, 'Class ID must be in the form "CLS01"'),
  academicYearId: z.string().min(1, "Academic year is required"),
  campusId: z.string().min(1, "Campus is required"),
  sortOrder: z.coerce.number().int().default(0),
  capacity: optionalNumber(z.coerce.number().int().positive()),
  classTeacherId: z.string().trim().min(1, "Class teacher is required"),
  gradingSystem: z.enum(GRADING_SYSTEMS).optional(),
  status: z.enum(ACTIVE_STATUSES).default("active"),
});

export type ClassInput = z.infer<typeof classInputSchema>;
