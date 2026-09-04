import type { Prisma } from "@/generated/prisma/client";
import { RECEIPT_SERIES } from "@/lib/constants/payments";

/**
 * Receipt numbering.
 *
 * Format: RCPT/2026-27/000123 — series, financial year, then a zero-padded
 * sequence that restarts each year. Auditors expect a receipt book to read as a
 * continuous run within a year, and "which year is this from" to be legible
 * without opening the system.
 *
 * The counter row is read and bumped inside the caller's transaction, so two
 * cashiers taking money at the same instant queue on the same row instead of
 * both reading `next = 41`. The unique index on (schoolId, receiptNumber) is
 * the backstop if that ever fails.
 */

/** Indian financial year: April to March, so a payment in Feb 2027 belongs to 2026-27. */
export function financialYearOf(date: Date): { startYear: number; label: string } {
  const month = date.getMonth(); // 0 = January
  const startYear = month >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, "0");
  return { startYear, label: `${startYear}-${endShort}` };
}

export async function nextReceiptNumber(
  tx: Prisma.TransactionClient,
  schoolId: string,
  issuedOn: Date,
): Promise<{ receiptNumber: string; series: string }> {
  const { startYear, label } = financialYearOf(issuedOn);

  // upsert-then-increment rather than read-then-write: the increment is atomic,
  // so the returned value is this caller's alone.
  await tx.receiptCounter.upsert({
    where: { schoolId_series_year: { schoolId, series: RECEIPT_SERIES, year: startYear } },
    create: { schoolId, series: RECEIPT_SERIES, year: startYear, next: 1 },
    update: {},
  });

  const counter = await tx.receiptCounter.update({
    where: { schoolId_series_year: { schoolId, series: RECEIPT_SERIES, year: startYear } },
    data: { next: { increment: 1 } },
    select: { next: true },
  });

  // `next` now holds the value *after* the bump, so this receipt takes the one before it.
  const sequence = counter.next - 1;

  return {
    receiptNumber: `${RECEIPT_SERIES}/${label}/${String(sequence).padStart(6, "0")}`,
    series: RECEIPT_SERIES,
  };
}

/** Payment numbers run in the same shape, on their own series, for cross-referencing. */
export function paymentNumberFrom(receiptNumber: string): string {
  return receiptNumber.replace(new RegExp(`^${RECEIPT_SERIES}`), "PAY");
}
