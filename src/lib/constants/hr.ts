/**
 * HR "enum-like" string values. SQLite has no native enum (see
 * prisma/schema.prisma), so these arrays back both the Zod schemas and the UI
 * <Select> options — add a value here once and it is available everywhere.
 *
 * Note what is deliberately NOT here: departments, designations, and employee
 * types are per-school master tables, not constants, because spec §29 requires
 * schools to configure their own. Only values with fixed system meaning
 * (workflow stages, document kinds) are hardcoded.
 */

export const EMPLOYMENT_STATUSES = [
  "active",
  "probation",
  "on_leave",
  "notice_period",
  "resigned",
  "terminated",
  "retired",
  "suspended",
  "inactive",
] as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: "Active",
  probation: "Probation",
  on_leave: "On Leave",
  notice_period: "Notice Period",
  resigned: "Resigned",
  terminated: "Terminated",
  retired: "Retired",
  suspended: "Suspended",
  inactive: "Inactive",
};

/**
 * Badge tone per status. Text labels always accompany the colour — colour is
 * never the only signal (spec §39, accessibility).
 */
export const EMPLOYMENT_STATUS_TONES: Record<EmploymentStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  active: "success",
  probation: "info",
  on_leave: "warning",
  notice_period: "warning",
  resigned: "neutral",
  terminated: "danger",
  retired: "neutral",
  suspended: "danger",
  inactive: "neutral",
};

/** Statuses that count as "currently employed" for headcount and payroll. */
export const ACTIVE_EMPLOYMENT_STATUSES: readonly EmploymentStatus[] = [
  "active",
  "probation",
  "on_leave",
  "notice_period",
];

export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed"] as const;

export const STAFF_DOCUMENT_TYPES = [
  "aadhaar",
  "pan",
  "passport",
  "photo",
  "education_certificate",
  "experience_certificate",
  "appointment_letter",
  "contract",
  "salary_certificate",
  "promotion_letter",
  "increment_letter",
  "warning_letter",
  "training_certificate",
  "resignation_letter",
  "relieving_letter",
  "other",
] as const;

export type StaffDocumentType = (typeof STAFF_DOCUMENT_TYPES)[number];

export const STAFF_DOCUMENT_TYPE_LABELS: Record<StaffDocumentType, string> = {
  aadhaar: "Aadhaar / Identity",
  pan: "PAN",
  passport: "Passport",
  photo: "Photograph",
  education_certificate: "Education Certificate",
  experience_certificate: "Experience Certificate",
  appointment_letter: "Appointment Letter",
  contract: "Contract",
  salary_certificate: "Salary Certificate",
  promotion_letter: "Promotion Letter",
  increment_letter: "Increment Letter",
  warning_letter: "Warning Letter",
  training_certificate: "Training Certificate",
  resignation_letter: "Resignation Letter",
  relieving_letter: "Relieving Letter",
  other: "Other",
};

export const DOCUMENT_STATUSES = ["pending", "verified", "rejected", "expired"] as const;

export const TRANSFER_TYPES = ["department", "campus", "designation", "manager", "location", "multiple"] as const;

// ---------------------------------------------------------------------------
// Recruitment
// ---------------------------------------------------------------------------

export const VACANCY_STATUSES = ["draft", "open", "on_hold", "closed", "cancelled"] as const;

/** The recruitment pipeline, in order. Stage lives on Application, not Candidate. */
export const APPLICATION_STAGES = [
  "new",
  "screening",
  "shortlisted",
  "interview",
  "selected",
  "offered",
  "joined",
] as const;

/** Terminal stages that sit outside the linear funnel. */
export const APPLICATION_TERMINAL_STAGES = ["rejected", "withdrawn", "hold"] as const;

export const APPLICATION_STATUSES = [...APPLICATION_STAGES, ...APPLICATION_TERMINAL_STAGES] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  screening: "Screening",
  shortlisted: "Shortlisted",
  interview: "Interview",
  selected: "Selected",
  offered: "Offered",
  joined: "Joined",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  hold: "Hold",
};

export const INTERVIEW_MODES = ["in_person", "video", "phone"] as const;
export const INTERVIEW_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
export const INTERVIEW_OUTCOMES = ["strong_hire", "hire", "hold", "reject"] as const;
export const INTERVIEW_PANEL_ROLES = ["hr", "hod", "principal", "subject_expert", "other"] as const;

/**
 * Default interview scorecard criteria for teaching roles. Stored per-evaluation
 * as JSON so a school can change criteria without a migration; this is only the
 * starting set the UI offers.
 */
export const TEACHING_INTERVIEW_CRITERIA = [
  { key: "subject_knowledge", label: "Subject Knowledge" },
  { key: "teaching_ability", label: "Teaching Ability" },
  { key: "communication", label: "Communication" },
  { key: "classroom_management", label: "Classroom Management" },
  { key: "experience", label: "Experience" },
  { key: "technology_skills", label: "Technology Skills" },
  { key: "problem_solving", label: "Problem Solving" },
  { key: "overall_fit", label: "Overall Fit" },
] as const;

export const OFFER_STATUSES = ["draft", "sent", "accepted", "rejected", "expired", "withdrawn"] as const;

export const CANDIDATE_SOURCES = [
  "referral",
  "job_portal",
  "walk_in",
  "agency",
  "website",
  "social_media",
  "other",
] as const;

export const CANDIDATE_DOCUMENT_TYPES = ["resume", "certificate", "portfolio", "id_proof", "other"] as const;
