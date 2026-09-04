export type ReportType = "attendance" | "fee_collection" | "fee_defaulters" | "staff_attendance";

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
