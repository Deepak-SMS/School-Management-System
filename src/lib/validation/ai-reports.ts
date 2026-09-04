import { z } from "zod";

export const REPORT_TYPE_VALUES = ["attendance", "fee_collection", "fee_defaulters", "staff_attendance"] as const;

export const aiReportGenerateSchema = z.object({
  reportType: z.enum(REPORT_TYPE_VALUES),
  academicYearId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export type AiReportGenerateInput = z.infer<typeof aiReportGenerateSchema>;

const generatedReportSchema = z.object({
  reportType: z.enum(REPORT_TYPE_VALUES),
  title: z.string(),
  generatedAt: z.string(),
  periodLabel: z.string(),
  filtersLabel: z.string(),
  keyStatistics: z.array(z.object({ label: z.string(), value: z.string() })),
  executiveSummary: z.string(),
  observations: z.string(),
  areasOfConcern: z.string(),
  recommendations: z.string(),
  conclusion: z.string(),
  narrativeError: z.string().optional(),
  tableTitle: z.string(),
  tableColumns: z.array(z.string()),
  tableRows: z.array(z.array(z.union([z.string(), z.number()]))),
});

export const aiReportExportSchema = z.object({
  format: z.enum(["pdf", "docx"]),
  report: generatedReportSchema,
});

export type AiReportExportInput = z.infer<typeof aiReportExportSchema>;
