import type { Prisma } from "@/generated/prisma/client";

/**
 * Certificate numbering: `{{prefix}}/{{year}}/{{00001}}`, restarting each
 * calendar year per certificate type — same upsert-then-increment shape as
 * `src/lib/fees/receipt-number.ts`, so two concurrent generations for the same
 * type/year queue on the same counter row instead of racing.
 */
export async function nextCertificateNumber(
  tx: Prisma.TransactionClient,
  params: { schoolId: string; certificateTypeId: string; prefix: string; year?: number },
): Promise<string> {
  const year = params.year ?? new Date().getFullYear();
  const key = { schoolId_certificateTypeId_year: { schoolId: params.schoolId, certificateTypeId: params.certificateTypeId, year } };

  await tx.certificateNumberingSequence.upsert({
    where: key,
    create: { schoolId: params.schoolId, certificateTypeId: params.certificateTypeId, year, next: 1 },
    update: {},
  });

  const counter = await tx.certificateNumberingSequence.update({
    where: key,
    data: { next: { increment: 1 } },
    select: { next: true },
  });

  // `next` now holds the value *after* the bump, so this certificate takes the one before it.
  const sequence = counter.next - 1;
  return `${params.prefix}/${year}/${String(sequence).padStart(5, "0")}`;
}
