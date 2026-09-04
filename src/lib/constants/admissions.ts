/** Where an admission enquiry came in from. */
export const ENQUIRY_SOURCES = ["walk_in", "phone", "website", "referral", "other"] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export const ENQUIRY_SOURCE_LABELS: Record<EnquirySource, string> = {
  walk_in: "Walk-in",
  phone: "Phone",
  website: "Website",
  referral: "Referral",
  other: "Other",
};

/**
 * The lead's progress toward becoming an application. `converted` is set only
 * by the system — once a submission arrives through the enquiry's generated
 * link — never chosen directly by staff (see admission-enquiry.ts).
 */
export const ENQUIRY_STATUSES = ["new", "contacted", "interested", "not_interested", "converted"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  not_interested: "Not interested",
  converted: "Converted",
};

/** Statuses staff may set directly through the edit form. */
export const EDITABLE_ENQUIRY_STATUSES = ENQUIRY_STATUSES.filter((s) => s !== "converted");

/**
 * Where a submitted application (StudentRegistration) stands. `pending` is the
 * only entry point (set at submission); `approved`/`rejected` are only ever set
 * by the review endpoint, since approving also creates the student record.
 * The statuses in between are a lightweight staff-visible tracker — useful for
 * schools that get more applications than they can decide on same-day.
 */
export const APPLICATION_STATUSES = [
  "pending",
  "under_review",
  "shortlisted",
  "waitlisted",
  "approved",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  shortlisted: "Shortlisted",
  waitlisted: "Waitlisted",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/** Once here, an application is closed — no further status change is allowed. */
export const TERMINAL_APPLICATION_STATUSES: ApplicationStatus[] = ["approved", "rejected", "withdrawn"];

/** Badge/bar tone per status — shared by the Applications list and the Reports page. */
export const APPLICATION_STATUS_TONE: Record<
  ApplicationStatus,
  "success" | "warning" | "neutral" | "danger" | "info" | "primary"
> = {
  pending: "warning",
  under_review: "info",
  shortlisted: "primary",
  waitlisted: "neutral",
  approved: "success",
  rejected: "danger",
  withdrawn: "danger",
};

/** Reachable through the lightweight status-only transition (not approve/reject, which go through review). */
export const APPLICATION_TRANSITION_STATUSES = ["under_review", "shortlisted", "waitlisted", "withdrawn"] as const;
