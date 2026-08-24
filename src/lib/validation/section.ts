import { z } from "zod";
import { ACTIVE_STATUSES } from "@/lib/constants/school";
import { optionalNumber } from "@/lib/validation/shared";

const optionalString = z.string().trim().max(255).optional();

export const sectionInputSchema = z.object({
  name: z.string().trim().min(1, "Section name is required").max(50),
  code: z.string().trim().min(1, "Section code is required").max(30),
  classId: z.string().min(1, "Class is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  campusId: z.string().min(1, "Campus is required"),
  room: optionalString,
  classTeacherId: optionalString,
  capacity: optionalNumber(z.coerce.number().int().positive()),
  status: z.enum(ACTIVE_STATUSES).default("active"),
});

export type SectionInput = z.infer<typeof sectionInputSchema>;
