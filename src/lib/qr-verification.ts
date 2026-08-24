import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Excludes visually ambiguous characters (0/O, 1/I) so a printed code stays readable.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 10): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

/**
 * Creates the secure, opaque verification identifier for a student/staff
 * record. This is deliberately NOT the admission/employee number — it's what
 * the QR code on the physical card encodes, so a photographed card can only
 * resolve to the public `/verify/{code}` page, never leak or guess other
 * records. See prisma/schema.prisma QRVerification for the field contract.
 */
export async function createQrVerification(
  tx: Prisma.TransactionClient,
  params: { schoolId: string; studentId?: string; staffId?: string },
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await tx.qRVerification.create({
        data: {
          code: randomCode(),
          schoolId: params.schoolId,
          studentId: params.studentId,
          staffId: params.staffId,
          visibleFieldsJson: JSON.stringify(
            params.studentId
              ? ["name", "admissionNumber", "class", "section", "status"]
              : ["name", "employeeId", "designation", "department", "status"],
          ),
        },
      });
    } catch (error) {
      const isCodeCollision =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (!isCodeCollision || attempt === 4) throw error;
    }
  }
  throw new Error("Failed to generate a unique verification code");
}

export async function findByVerificationCode(code: string) {
  return prisma.qRVerification.findUnique({
    where: { code },
    include: { student: true, staff: { include: { designation: { select: { name: true } } } }, school: true, idCard: true },
  });
}
