import type { ApiError } from "@/services/studentService";
import type { PaymentInput } from "@/lib/validation/payment";

export interface ReceiptComponent {
  label: string;
  category: string;
  charged: number;
  paidNow: number;
  paidToDate: number;
  outstanding: number;
}

export interface ReceiptRecord {
  id: string;
  receiptNumber: string;
  series: string;
  issuedOn: string;
  status: string;
  voidReason?: string | null;
  voidedAt?: string | null;

  schoolName: string;
  schoolAddress?: string | null;
  schoolLogoUrl?: string | null;

  studentId: string;
  studentName: string;
  admissionNumber: string;
  className?: string | null;
  sectionName?: string | null;
  academicYear?: string | null;

  amountPaid: number;
  method: string;
  referenceNo?: string | null;
  invoiceRef?: string | null;
  paidOn: string;
  balanceAfter: number;

  emailedAt?: string | null;
  emailedTo?: string | null;

  payment?: {
    id: string;
    paymentNumber: string;
    method: string;
    bankName?: string | null;
    note?: string | null;
    status: string;
    cancelReason?: string | null;
    cancelledAt?: string | null;
  };
  components?: ReceiptComponent[];
}

export interface ReceiptListResponse {
  data: ReceiptRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalCollected: number;
}

export interface ChargeBalance {
  chargeId: string;
  label: string;
  categoryName: string;
  dueDate: string | null;
  charged: number;
  adjusted: number;
  paid: number;
  outstanding: number;
}

export interface StudentBalanceResponse {
  student: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    admissionNumber: string;
    class?: { name: string } | null;
    section?: { name: string } | null;
  };
  charges: ChargeBalance[];
  totalCharged: number;
  totalAdjusted: number;
  totalPaid: number;
  totalOutstanding: number;
}

export interface RecordPaymentResponse {
  payment: { id: string; paymentNumber: string; amount: number };
  receipt: ReceiptRecord;
  unallocated: number;
  balanceAfter: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export interface ReceiptListParams {
  q?: string;
  studentId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const receiptService = {
  async list(params: ReceiptListParams = {}): Promise<ReceiptListResponse> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    return parseOrThrow(await fetch(`/api/fees/receipts?${query.toString()}`));
  },

  async get(id: string): Promise<ReceiptRecord> {
    return parseOrThrow(await fetch(`/api/fees/receipts/${id}`));
  },

  /** The inline PDF URL — used by both the print view and the download link. */
  pdfUrl(id: string, download = false): string {
    return `/api/fees/receipts/${id}/pdf${download ? "?download=1" : ""}`;
  },

  async email(id: string, body: { to?: string; message?: string } = {}): Promise<{ sentTo: string; emailedAt: string }> {
    return parseOrThrow(
      await fetch(`/api/fees/receipts/${id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  },

  async studentBalance(studentId: string): Promise<StudentBalanceResponse> {
    return parseOrThrow(await fetch(`/api/fees/students/${studentId}/balance`));
  },

  async recordPayment(input: PaymentInput): Promise<RecordPaymentResponse> {
    return parseOrThrow(
      await fetch("/api/fees/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  },

  async cancelPayment(paymentId: string, reason: string): Promise<void> {
    await parseOrThrow(
      await fetch(`/api/fees/payments/${paymentId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
    );
  },
};
