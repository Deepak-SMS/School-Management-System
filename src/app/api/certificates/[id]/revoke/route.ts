import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const revokeSchema = z.object({ reason: z.string().trim().min(1, "A reason is required").max(500) });

/**
 * Revokes a certificate — never deletes the row. The verification page keeps
 * resolving the code so a school checking an old printout sees "revoked", not
 * a broken link, per the brief's revoke/reissue requirement (§7, §11).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("certificates", "delete");
    const { schoolId } = user;
    const { id } = await params;
    const { reason } = revokeSchema.parse(await request.json());

    const existing = await prisma.certificate.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
    if (existing.status === "revoked") return NextResponse.json({ error: "This certificate is already revoked." }, { status: 409 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.certificate.update({
        where: { id },
        data: { status: "revoked", revokedAt: new Date(), revokedReason: reason },
      });
      // The verification code stays resolvable on purpose — the public page must
      // still show "Revoked" with the certificate's details, not a dead link, so
      // anyone checking an old printout gets a real answer. `isActive` on
      // CertificateVerification is reserved for the code itself being retired
      // (e.g. a reissue), which certificate.status already covers here.
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "certificate.revoke",
        entityType: "Certificate",
        entityId: id,
        before: { status: existing.status },
        after: { status: "revoked", reason },
      });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
