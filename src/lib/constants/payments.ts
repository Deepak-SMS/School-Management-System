/**
 * Enum-like string fields for payments and receipts. SQLite has no native enum
 * type (see prisma/schema.prisma), so these arrays back both the Zod schemas
 * and the UI <Select> options.
 */

export const PAYMENT_METHODS = ["cash", "cheque", "dd", "upi", "card", "net_banking", "bank_transfer", "other"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  dd: "Demand Draft",
  upi: "UPI",
  card: "Card",
  net_banking: "Net Banking",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

/**
 * Methods where a reference number is the only proof the money moved. Cash has
 * none, which is exactly why the receipt matters more there.
 */
export const METHODS_REQUIRING_REFERENCE: PaymentMethod[] = ["cheque", "dd", "upi", "card", "net_banking", "bank_transfer"];

/** Methods drawn on a bank account, where the bank name is worth capturing. */
export const METHODS_WITH_BANK: PaymentMethod[] = ["cheque", "dd", "bank_transfer", "net_banking"];

export const PAYMENT_STATUSES = ["recorded", "cancelled"] as const;

export const PAYMENT_STATUS_LABELS: Record<(typeof PAYMENT_STATUSES)[number], string> = {
  recorded: "Recorded",
  cancelled: "Cancelled",
};

export const RECEIPT_STATUSES = ["issued", "void"] as const;

export const RECEIPT_STATUS_LABELS: Record<(typeof RECEIPT_STATUSES)[number], string> = {
  issued: "Issued",
  void: "Void",
};

/** Prefix for receipt numbers. Kept a constant so the series is stable per school. */
export const RECEIPT_SERIES = "RCPT";
