import { z } from "zod";
import {
  APPLICATION_STATUSES,
  CANDIDATE_SOURCES,
  INTERVIEW_MODES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_PANEL_ROLES,
  OFFER_STATUSES,
  VACANCY_STATUSES,
} from "@/lib/constants/hr";

/**
 * Recruitment validation.
 *
 * As elsewhere in this codebase, no `.default()` is used on fields that a PATCH
 * might omit — Zod applies defaults under `.partial()` too, which would silently
 * reset unspecified fields. Create routes apply defaults explicitly.
 */

const optionalString = z.string().trim().max(255).optional();
const optionalText = z.string().trim().max(5000).optional();

const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date");

const optionalMoney = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().min(0).max(1_000_000_000).optional(),
);

const optionalYears = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().min(0).max(60).optional(),
);

/** Skills arrive as an array from the UI and are stored as JSON (SQLite has no array type). */
const skillsArray = z.array(z.string().trim().min(1).max(60)).max(40).optional();

export const jobPositionInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  departmentId: optionalString,
  designationId: optionalString,
  employeeTypeId: optionalString,
  requiredQualification: optionalString,
  requiredExperienceYears: optionalYears,
  skills: skillsArray,
  salaryRangeMin: optionalMoney,
  salaryRangeMax: optionalMoney,
  description: optionalText,
  responsibilities: optionalText,
  status: z.enum(["active", "inactive"]).optional(),
});

export type JobPositionInput = z.infer<typeof jobPositionInputSchema>;

export const vacancyInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(150),
    code: optionalString,
    jobPositionId: optionalString,
    departmentId: optionalString,
    designationId: optionalString,
    campusId: optionalString,
    employeeTypeId: optionalString,
    positionsCount: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
      z.number().int().min(1, "At least one position").max(500).optional(),
    ),
    salaryRangeMin: optionalMoney,
    salaryRangeMax: optionalMoney,
    requiredQualification: optionalString,
    requiredExperienceYears: optionalYears,
    skills: skillsArray,
    description: optionalText,
    responsibilities: optionalText,
    openingDate: optionalDate,
    closingDate: optionalDate,
    hiringManagerId: optionalString,
    status: z.enum(VACANCY_STATUSES).optional(),
  })
  .refine((v) => !v.salaryRangeMin || !v.salaryRangeMax || v.salaryRangeMin <= v.salaryRangeMax, {
    message: "Maximum salary must be at least the minimum",
    path: ["salaryRangeMax"],
  })
  .refine((v) => !v.openingDate || !v.closingDate || new Date(v.openingDate) <= new Date(v.closingDate), {
    message: "Closing date must be on or after the opening date",
    path: ["closingDate"],
  });

export type VacancyInput = z.infer<typeof vacancyInputSchema>;

export const VACANCY_DEFAULTS = { positionsCount: 1, status: "draft" as const };

export const candidateInputSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80).optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email address"),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9+\-\s()]{7,20}$/.test(v), "Invalid phone number"),
  photoFileId: optionalString,
  resumeFileId: optionalString,
  address: optionalText,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  pinCode: optionalString,
  currentOrganization: optionalString,
  currentDesignation: optionalString,
  totalExperienceYears: optionalYears,
  noticePeriodDays: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).max(365).optional(),
  ),
  currentSalary: optionalMoney,
  expectedSalary: optionalMoney,
  highestQualification: optionalString,
  university: optionalString,
  passingYear: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1900).max(2200).optional(),
  ),
  skills: skillsArray,
  certifications: skillsArray,
  source: z.enum(CANDIDATE_SOURCES).optional(),
  recruiterId: optionalString,
});

export type CandidateInput = z.infer<typeof candidateInputSchema>;

/** Creating an application is "this candidate applies to this vacancy". */
export const applicationInputSchema = z.object({
  candidateId: z.string().trim().min(1, "Candidate is required"),
  vacancyId: z.string().trim().min(1, "Vacancy is required"),
  source: z.enum(CANDIDATE_SOURCES).optional(),
  recruiterId: optionalString,
  notes: optionalText,
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;

/** Moving an application along the pipeline. */
export const applicationStageSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
  note: z.string().trim().max(1000).optional(),
  rejectionReason: z.string().trim().max(1000).optional(),
});

export const screeningInputSchema = z.object({
  screeningScore: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(100).optional(),
  ),
  screeningComments: optionalText,
  /** The screener's decision — shortlist, reject, or park. */
  outcome: z.enum(["shortlisted", "rejected", "hold"]),
  rejectionReason: z.string().trim().max(1000).optional(),
});

export const selectionInputSchema = z.object({
  proposedDesignationId: optionalString,
  proposedDepartmentId: optionalString,
  proposedCampusId: optionalString,
  proposedSalary: optionalMoney,
  proposedJoiningDate: optionalDate,
  proposedManagerId: optionalString,
});

export const interviewInputSchema = z.object({
  applicationId: z.string().trim().min(1, "Application is required"),
  roundNumber: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1).max(20).optional(),
  ),
  roundName: optionalString,
  scheduledAt: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date and time"),
  durationMinutes: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(5).max(600).optional(),
  ),
  mode: z.enum(INTERVIEW_MODES).optional(),
  location: optionalString,
  meetingLink: optionalString,
  /** Staff ids forming the interview panel. */
  panelStaffIds: z.array(z.string().trim().min(1)).max(10).optional(),
  panelRole: z.enum(INTERVIEW_PANEL_ROLES).optional(),
});

export type InterviewInput = z.infer<typeof interviewInputSchema>;

export const INTERVIEW_DEFAULTS = { roundNumber: 1, mode: "in_person" as const, status: "scheduled" as const };

export const interviewEvaluationSchema = z.object({
  /** { criterionKey: rating } — criteria are configurable, so this stays open. */
  scores: z.record(z.string().trim().max(60), z.number().min(0).max(10)).optional(),
  overallScore: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(10).optional(),
  ),
  recommendation: z.enum(INTERVIEW_OUTCOMES),
  comments: optionalText,
});

export const demoClassInputSchema = z.object({
  applicationId: z.string().trim().min(1, "Application is required"),
  scheduledAt: optionalDate,
  subject: optionalString,
  gradeLevel: optionalString,
  topic: optionalString,
  evaluatorStaffId: optionalString,
  teachingScore: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(10).optional(),
  ),
  classroomManagementScore: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(10).optional(),
  ),
  studentInteractionScore: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(10).optional(),
  ),
  feedback: optionalText,
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
});

export const offerInputSchema = z.object({
  applicationId: z.string().trim().min(1, "Application is required"),
  designationId: optionalString,
  departmentId: optionalString,
  campusId: optionalString,
  employeeTypeId: optionalString,
  salaryAmount: optionalMoney,
  joiningDate: optionalDate,
  workLocation: optionalString,
  reportingManagerId: optionalString,
  expiryDate: optionalDate,
  termsText: optionalText,
});

export type OfferInput = z.infer<typeof offerInputSchema>;

export const offerStatusSchema = z.object({
  status: z.enum(OFFER_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

/** Extra details the recruiter may set when turning an accepted offer into an employee. */
export const conversionInputSchema = z.object({
  employeeId: z.string().trim().max(50).optional(),
  joiningDate: optionalDate,
  departmentId: optionalString,
  designationId: optionalString,
  campusId: optionalString,
  employeeTypeId: optionalString,
  reportingManagerId: optionalString,
  category: optionalString,
});

export type ConversionInput = z.infer<typeof conversionInputSchema>;

/** Serializes a string array to the JSON column shape, or undefined to leave it alone. */
export function toJsonArray(values: string[] | undefined): string | undefined {
  return values ? JSON.stringify(values) : undefined;
}

/** Parses a JSON array column back to a string array, tolerating null/garbage. */
export function fromJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
