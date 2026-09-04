/** Shared reference shapes — the same slice every list/detail response nests a related record as. */
interface NamedRef {
  id: string;
  name: string;
}

export interface FeeCategoryRecord {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isRefundable: boolean;
  sortOrder: number;
  status: string;
  counts?: { items: number };
  createdAt: string;
  updatedAt: string;
}

export interface FeeStudentCategoryRecord {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  sortOrder: number;
  status: string;
  counts?: { students: number; feeStructures: number };
  createdAt: string;
  updatedAt: string;
}

export interface LateFeeRuleRecord {
  id: string;
  name: string;
  calculationType: string;
  amount?: number | null;
  percentage?: number | null;
  graceDays: number;
  maxAmount?: number | null;
  status: string;
  counts?: { items: number };
  createdAt: string;
  updatedAt: string;
}

export interface FeeInstallmentRecord {
  id: string;
  label: string;
  dueDate: string;
  amount: number;
  sortOrder: number;
}

export interface FeeStructureItemRecord {
  id: string;
  feeCategoryId: string;
  feeCategory: NamedRef & { code: string };
  amount: number;
  frequency: string;
  isOptional: boolean;
  lateFeeRuleId?: string | null;
  lateFeeRule?: NamedRef | null;
  sortOrder: number;
  installments: FeeInstallmentRecord[];
}

/** Shape returned by GET /api/fee-structures (and /api/fee-structures/[id]). */
export interface FeeStructureRecord {
  id: string;
  name: string;
  description?: string | null;
  academicYearId: string;
  academicYear: NamedRef | { id: string; label: string };
  classId?: string | null;
  class?: NamedRef | null;
  sectionId?: string | null;
  section?: NamedRef | null;
  studentCategoryId?: string | null;
  studentCategory?: NamedRef | null;
  status: string;
  publishedAt?: string | null;
  items: FeeStructureItemRecord[];
  /** Sum of every item's `amount` — the total a student on this structure pays across the year. */
  totalAmount: number;
  counts?: { assignedStudents: number };
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructureListResponse {
  data: FeeStructureRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FeeStructurePublishResult {
  structure: FeeStructureRecord;
  newlyAssigned: number;
  totalAssigned: number;
  chargesGenerated: number;
}

export interface EligibleStudentsPreview {
  count: number;
}
