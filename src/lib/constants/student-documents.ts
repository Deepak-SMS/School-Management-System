/**
 * Documents a school collects for a student.
 *
 * Split by `category` so the admission checklist stays a checklist — the papers
 * needed to enrol — while academic records accumulate separately over the years
 * without burying it.
 *
 * `sensitive` marks documents that reveal protected characteristics. They are
 * collected only where a school is legally required to (RTE quota, board
 * reporting) and are never required to save a student.
 */
export const STUDENT_DOCUMENT_TYPES = [
  // --- Admission ---
  { value: "birth_certificate", label: "Birth Certificate", category: "admission" },
  { value: "transfer_certificate", label: "School Leaving / Transfer Certificate", category: "admission" },
  { value: "previous_marksheet", label: "Previous Marksheet", category: "admission" },
  { value: "photograph", label: "Student Photograph", category: "admission" },
  { value: "address_proof", label: "Address Proof", category: "admission" },
  { value: "government_id", label: "Government ID", category: "admission", sensitive: true },
  { value: "caste_certificate", label: "Caste / Category Certificate", category: "admission", sensitive: true },
  { value: "disability_certificate", label: "Disability Certificate", category: "admission", sensitive: true },
  { value: "migration_certificate", label: "Migration Certificate", category: "admission" },
  { value: "other", label: "Other supporting document", category: "admission" },

  // --- Academic ---
  { value: "report_card", label: "Report Card", category: "academic" },
  { value: "board_document", label: "Board Document", category: "academic" },
  { value: "achievement", label: "Achievement Certificate", category: "academic" },
] as const;

export type StudentDocumentType = (typeof STUDENT_DOCUMENT_TYPES)[number]["value"];

export const STUDENT_DOCUMENT_TYPE_VALUES = STUDENT_DOCUMENT_TYPES.map((d) => d.value);

export const STUDENT_DOCUMENT_LABELS: Record<string, string> = Object.fromEntries(
  STUDENT_DOCUMENT_TYPES.map((d) => [d.value, d.label]),
);

export const STUDENT_DOCUMENT_CATEGORIES = ["admission", "academic"] as const;

/** Papers most schools won't enrol without — surfaced as an outstanding list. */
export const CORE_ADMISSION_DOCUMENTS: StudentDocumentType[] = [
  "birth_certificate",
  "transfer_certificate",
  "photograph",
];

export const ADMISSION_TYPES = ["new", "transfer", "readmission", "staff_ward", "rte"] as const;

export const ADMISSION_TYPE_LABELS: Record<string, string> = {
  new: "New admission",
  transfer: "Transfer",
  readmission: "Re-admission",
  staff_ward: "Staff ward",
  rte: "RTE quota",
};

export const PROMOTION_STATUSES = ["pending", "promoted", "retained", "passed_out"] as const;

export const PROMOTION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  promoted: "Promoted",
  retained: "Retained",
  passed_out: "Passed out",
};

/** Common instruction languages; the field stays free text so a school can add its own. */
export const MEDIUM_SUGGESTIONS = ["English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Bengali", "Gujarati"];

/** Streams only apply in senior classes; blank is normal below that. */
export const STREAM_SUGGESTIONS = ["Science", "Commerce", "Arts", "Vocational"];
