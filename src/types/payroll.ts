export interface SalaryComponentRecord {
  id: string;
  name: string;
  code: string;
  componentType: string;
  calculationType: string;
  amount?: number | null;
  percentage?: number | null;
  formula?: string | null;
  isTaxable: boolean;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryStructureItemRecord {
  id: string;
  componentId: string;
  amount?: number | null;
  percentage?: number | null;
  sortOrder: number;
  component: SalaryComponentRecord;
}

export interface SalaryStructureAssignmentRef {
  id: string;
  staffId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  staff: { id: string; fullName: string; employeeId: string };
}

export interface SalaryStructureRecord {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  items: SalaryStructureItemRecord[];
  assignments?: SalaryStructureAssignmentRef[];
  assignedStaffCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRuleRecord {
  id: string;
  ruleType: string;
  effectiveDate: string;
  rate?: number | null;
  thresholdAmount?: number | null;
  employeeContributionPercent?: number | null;
  employerContributionPercent?: number | null;
  applicableEmployeeGroup: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollPeriodRecord {
  id: string;
  year: number;
  month: number;
  status: string;
  processedAt?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  lockedById?: string | null;
  lockedAt?: string | null;
  reopenedById?: string | null;
  reopenedAt?: string | null;
  reopenReason?: string | null;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayLineRef {
  label: string;
  amount: number;
}

export interface PayrollEntryRecord {
  id: string;
  staffId: string;
  structureId?: string | null;
  workingDays: number;
  payableDays: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  earnings: PayLineRef[];
  deductions: PayLineRef[];
  status: string;
  staff: {
    id: string;
    employeeId: string;
    fullName: string;
    designation?: { name: string } | null;
    department?: { name: string } | null;
  };
  structure?: { id: string; name: string } | null;
  slip?: { id: string; slipNumber: string; pdfFileId?: string | null } | null;
  slipPdfUrl?: string | null;
}

export interface PayrollPeriodDetail extends PayrollPeriodRecord {
  entries: PayrollEntryRecord[];
}

export interface PayrollProcessResult {
  period: PayrollPeriodRecord;
  processedCount: number;
  skipped: { staffId: string; reason: string }[];
}

export interface SalarySlipRecord {
  id: string;
  slipNumber: string;
  generatedAt: string;
  pdfUrl?: string | null;
  netSalary: number;
  staff: { id: string; fullName: string; employeeId: string; designation?: { name: string } | null };
  period: { id: string; year: number; month: number };
}

export interface SalarySlipListResponse {
  data: SalarySlipRecord[];
  total: number;
  page: number;
  pageSize: number;
}
