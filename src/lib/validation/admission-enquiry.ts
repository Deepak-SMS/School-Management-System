import { z } from "zod";
import { ENQUIRY_SOURCES, EDITABLE_ENQUIRY_STATUSES } from "@/lib/constants/admissions";

const optionalString = z.string().trim().max(255).optional();
const optionalText = z.string().trim().max(1000).optional();

const phone = z
  .string()
  .trim()
  .refine((v) => /^[0-9+\-\s()]{7,20}$/.test(v), "Invalid phone number");

const email = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email address");

export const admissionEnquiryInputSchema = z.object({
  parentName: z.string().trim().min(1, "Parent/guardian name is required").max(150),
  parentPhone: phone,
  parentEmail: email,
  childName: z.string().trim().min(1, "Child's name is required").max(150),
  childDob: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date of birth"),
  interestedClassId: optionalString,
  source: z.enum(ENQUIRY_SOURCES).default("walk_in"),
  // `converted` is set only by a real submission arriving — never chosen here.
  status: z.enum(EDITABLE_ENQUIRY_STATUSES).optional(),
  followUpDate: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid follow-up date"),
  assignedToId: optionalString,
  notes: optionalText,
});

export type AdmissionEnquiryInput = z.infer<typeof admissionEnquiryInputSchema>;
