import { randomBytes } from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Excludes visually ambiguous characters (0/O, 1/I) so a printed code stays readable.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 10): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

/**
 * Creates the public verification record for a certificate — same intent as
 * `createQrVerification` for ID cards: the QR code encodes an opaque token,
 * never the certificate number, so a photographed certificate can't be used to
 * enumerate other records. `visibleFieldsJson` deliberately excludes marks,
 * address, and contact details per the certificate brief's "don't expose
 * unnecessary information" rule.
 */
export async function createCertificateVerification(tx: Prisma.TransactionClient, params: { schoolId: string; certificateId: string }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await tx.certificateVerification.create({
        data: {
          code: randomCode(),
          schoolId: params.schoolId,
          certificateId: params.certificateId,
          visibleFieldsJson: JSON.stringify(["certificateNumber", "name", "certificateType", "school", "issueDate", "status"]),
        },
      });
    } catch (error) {
      const isCodeCollision = typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
      if (!isCodeCollision || attempt === 4) throw error;
    }
  }
  throw new Error("Failed to generate a unique verification code");
}

export async function findCertificateByVerificationCode(code: string) {
  return prisma.certificateVerification.findUnique({
    where: { code },
    include: {
      school: true,
      certificate: {
        include: {
          certificateType: true,
          student: true,
          staff: true,
        },
      },
    },
  });
}
