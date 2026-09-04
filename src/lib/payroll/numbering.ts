import type { Prisma } from "@/generated/prisma/client";

/**
 * Salary slip numbering: `SAL/{{year}}/{{00001}}`, restarting each calendar
 * year — same upsert-then-increment shape as `src/lib/certificates/numbering.ts`,
 * so two concurrent slip generations queue on the same counter row instead of
 * racing.
 */
export async function nextSalarySlipNumber(
  tx: Prisma.TransactionClient,
  params: { schoolId: string; year?: number },
): Promise<string> {
  const year = params.year ?? new Date().getFullYear();
  const key = { schoolId_year: { schoolId: params.schoolId, year } };

  await tx.salarySlipNumberingSequence.upsert({
    where: key,
    create: { schoolId: params.schoolId, year, next: 1 },
    update: {},
  });

  const counter = await tx.salarySlipNumberingSequence.update({
    where: key,
    data: { next: { increment: 1 } },
    select: { next: true },
  });

  // `next` now holds the value *after* the bump, so this slip takes the one before it.
  const sequence = counter.next - 1;
  return `SAL/${year}/${String(sequence).padStart(5, "0")}`;
}
