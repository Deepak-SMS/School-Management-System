/**
 * Report types limited to ones with real data behind them today — no
 * Examination/Student-Performance/HR-Payroll/Monthly-composite reports, since
 * those need models (exam marks, payroll) that don't exist yet. See
 * AI-ROADMAP.md §2. Extend this union only once the underlying module ships
 * real data.
 */
export type ReportType = "attendance" | "fee_collection" | "fee_defaulters" | "staff_attendance";

export const REPORT_TYPES: { value: ReportType; label: string; description: string; needsClassSection: boolean }[] = [
  { value: "attendance", label: "Attendance Report", description: "Student attendance over a date range, with low-attendance students called out.", needsClassSection: true },
  { value: "fee_collection", label: "Fee Collection Report", description: "Total charged, collected, and pending across the period.", needsClassSection: true },
  { value: "fee_defaulters", label: "Fee Defaulter Report", description: "Students with overdue fees, sorted by amount owed.", needsClassSection: true },
  { value: "staff_attendance", label: "Teacher Attendance Report", description: "Staff attendance over a date range, with anyone below threshold called out.", needsClassSection: false },
];

export interface ReportFilters {
  schoolId: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  from: Date;
  /** Exclusive upper bound. */
  to: Date;
}

export interface ReportKeyStat {
  label: string;
  value: string;
}

export interface GeneratedReport {
  reportType: ReportType;
  title: string;
  generatedAt: string;
  periodLabel: string;
  filtersLabel: string;
  keyStatistics: ReportKeyStat[];
  executiveSummary: string;
  observations: string;
  areasOfConcern: string;
  recommendations: string;
  conclusion: string;
  narrativeError?: string;
  tableTitle: string;
  tableColumns: string[];
  tableRows: (string | number)[][];
}
