/** Shape returned by GET /api/school — the full School (tenant) row. */
export interface SchoolProfileRecord {
  id: string;
  name: string;
  shortName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pinCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  affiliationBoard?: string | null;
  schoolCode?: string | null;
  principalName?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  udisePlusCode?: string | null;
  udiseSchoolId?: string | null;
  boardAffiliationNumber?: string | null;
  recognitionNumber?: string | null;
  rteRegistrationNumber?: string | null;
  nocNumber?: string | null;
  registrationNumber?: string | null;
  schoolType?: string | null;
  institutionType?: string | null;
  establishedYear?: number | null;
  alternatePhone?: string | null;
  administratorName?: string | null;
  administrativeEmail?: string | null;
  administrativePhone?: string | null;
  timeZone?: string | null;
  currency?: string | null;
  dateFormat?: string | null;
  language?: string | null;
  weekStartDay?: string | null;
  workingDaysJson?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Edit-form shape — same fields as the record, but `null` collapses to `undefined` (forms never hold null). */
export type SchoolProfileInput = {
  [K in keyof Omit<SchoolProfileRecord, "id" | "createdAt" | "updatedAt" | "logoUrl" | "bannerUrl">]?: Exclude<SchoolProfileRecord[K], null>;
};
