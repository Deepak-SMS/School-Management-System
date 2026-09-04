import type { Prisma } from "@/generated/prisma/client";

/**
 * Accession/barcode numbering: `LIB-{year}-{0000001}`, restarting each
 * calendar year — same upsert-then-increment shape as
 * `src/lib/fees/receipt-number.ts` and `src/lib/certificates/numbering.ts`,
 * so two concurrent bulk-generate requests queue on the same counter row
 * instead of racing. Used for both `accessionNumber` and `barcode` at
 * creation time — they start identical, and either can be corrected later.
 */
export async function nextAccessionNumber(
  tx: Prisma.TransactionClient,
  params: { schoolId: string; year?: number },
): Promise<string> {
  const year = params.year ?? new Date().getFullYear();
  const key = { schoolId_year: { schoolId: params.schoolId, year } };

  await tx.libraryAccessionCounter.upsert({
    where: key,
    create: { schoolId: params.schoolId, year, next: 1 },
    update: {},
  });

  const counter = await tx.libraryAccessionCounter.update({
    where: key,
    data: { next: { increment: 1 } },
    select: { next: true },
  });

  // `next` now holds the value *after* the bump, so this copy takes the one before it.
  const sequence = counter.next - 1;
  return `LIB-${year}-${String(sequence).padStart(7, "0")}`;
}
