import { z } from "zod";
import { ACTIVE_STATUSES, GRADING_SYSTEMS } from "@/lib/constants/school";
import { optionalNumber } from "@/lib/validation/shared";

const optionalString = z.string().trim().max(255).optional();

export const classInputSchema = z.object({
  name: z.string().trim().min(1, "Class name is required").max(100),
  code: z.string().trim().min(1, "Class code is required").max(30),
  academicYearId: z.string().min(1, "Academic year is required"),
  campusId: z.string().min(1, "Campus is required"),
  sortOrder: z.coerce.number().int().default(0),
  capacity: optionalNumber(z.coerce.number().int().positive()),
  classTeacherId: optionalString,
  gradingSystem: z.enum(GRADING_SYSTEMS).optional(),
  status: z.enum(ACTIVE_STATUSES).default("active"),
});

export type ClassInput = z.infer<typeof classInputSchema>;
