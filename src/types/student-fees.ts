import type { StudentFeeSummary } from "@/lib/student-fee-ledger";

interface NamedRef {
  id: string;
  name: string;
}

export interface StudentFeeAdjustmentRecord {
  id: string;
  chargeId: string | null;
  type: string;
  amount: number;
  reason: string | null;
  relatedStudentId: string | null;
  relatedStudent?: { id: string; firstName: string; lastName: string; admissionNumber: string } | null;
  appliedAt: string;
}

export interface StudentFeeChargeRecord {
  id: string;
  feeStructureId: string | null;
  feeStructure?: NamedRef | null;
  feeStructureItemId: string | null;
  feeCategoryId: string;
  feeCategory: NamedRef & { code: string };
  label: string;
  amount: number;
  /** `amount` reduced by this charge's own waiver/discount/correction/transfer-out adjustments, before any payment — see src/lib/student-fee-ledger.ts. */
  adjustedAmount: number;
  waivedAmount: number;
  /** Sum of non-cancelled payments allocated against this charge. */
  paidAmount: number;
  /** `adjustedAmount` minus `paidAmount` — what's actually left to collect (can be negative if overpaid). */
  outstandingAmount: number;
  dueDate: string | null;
  isManual: boolean;
  status: string;
  note: string | null;
  adjustments: StudentFeeAdjustmentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentFeeAccountStudentRef {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  photoUrl?: string | null;
  class: NamedRef;
  section?: NamedRef | null;
}

/** Shape returned by GET /api/students/[id]/fees — the full financial account for one student. */
export interface StudentFeeAccountRecord {
  student: StudentFeeAccountStudentRef;
  summary: StudentFeeSummary;
  charges: StudentFeeChargeRecord[];
  adjustments: StudentFeeAdjustmentRecord[];
}

/** One row of GET /api/student-fees — the lightweight summary the list page renders per student. */
export interface StudentFeeListRow {
  student: StudentFeeAccountStudentRef;
  summary: StudentFeeSummary;
}

/** One optional fee item a student is eligible to opt into — from a structure they're actively assigned to but don't already have a charge for. Feeds the "From fee structure" path of the add-charge modal. */
export interface AvailableFeeItemRecord {
  id: string;
  amount: number;
  frequency: string;
  feeCategory: NamedRef & { code: string };
  feeStructure: NamedRef;
}

export interface StudentFeeListResponse {
  data: StudentFeeListRow[];
  total: number;
  page: number;
  pageSize: number;
}
