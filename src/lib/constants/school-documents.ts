/**
 * The compliance documents a school is asked to produce, each tied to the
 * registration number it evidences.
 *
 * `field` names the column on School holding that number, so the profile can
 * show a document alongside the value it proves — and flag a number that has no
 * document behind it, which is what an inspection actually asks for.
 */
export const SCHOOL_DOCUMENT_TYPES = [
  {
    value: "udise_plus_code",
    label: "UDISE+ Code",
    field: "udisePlusCode",
    hint: "UDISE+ portal listing or certificate",
  },
  {
    value: "udise_school_id",
    label: "UDISE School ID",
    field: "udiseSchoolId",
    hint: "UDISE school record",
  },
  {
    value: "recognition_number",
    label: "Recognition Number",
    field: "recognitionNumber",
    hint: "State recognition certificate",
  },
  {
    value: "board_affiliation",
    label: "Board Affiliation Number",
    field: "boardAffiliationNumber",
    hint: "Board affiliation letter (CBSE / ICSE / State)",
  },
  {
    value: "school_code",
    label: "School Code",
    field: "schoolCode",
    hint: "Board-issued school code letter",
  },
  {
    value: "rte_registration",
    label: "RTE Recognition / Registration No.",
    field: "rteRegistrationNumber",
    hint: "RTE recognition certificate",
  },
  {
    value: "noc_number",
    label: "NOC Number",
    field: "nocNumber",
    hint: "No-Objection Certificate",
  },
  {
    value: "other",
    label: "Other document",
    field: null,
    hint: "Trust deed, land records, fire or building safety certificate",
  },
] as const;

export type SchoolDocumentType = (typeof SCHOOL_DOCUMENT_TYPES)[number]["value"];

export const SCHOOL_DOCUMENT_TYPE_VALUES = SCHOOL_DOCUMENT_TYPES.map((d) => d.value);

export const SCHOOL_DOCUMENT_LABELS: Record<string, string> = Object.fromEntries(
  SCHOOL_DOCUMENT_TYPES.map((d) => [d.value, d.label]),
);

export const SCHOOL_DOCUMENT_STATUSES = ["pending", "verified", "rejected"] as const;

/** Days before expiry at which a certificate is flagged as due for renewal. */
export const SCHOOL_DOCUMENT_EXPIRY_WARNING_DAYS = 60;
