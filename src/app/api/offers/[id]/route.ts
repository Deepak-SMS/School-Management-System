import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { offerStatusSchema } from "@/lib/validation/recruitment";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** What an offer may move to from each state. Kept local — it is not the application pipeline. */
const OFFER_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "withdrawn"],
  sent: ["accepted", "rejected", "expired", "withdrawn"],
  accepted: [],
  rejected: [],
  expired: ["sent"],
  withdrawn: [],
};

/**
 * Advances an offer. Accepting one moves the application to `offered` so the
 * candidate becomes eligible for conversion; rejecting closes the application.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("offers", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.offer.findFirst({
      where: { id, schoolId },
      include: { application: { select: { id: true, status: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

    const input = offerStatusSchema.parse(await request.json());
    const allowed = OFFER_TRANSITIONS[existing.status] ?? [];

    if (existing.status !== input.status && !allowed.includes(input.status)) {
      return NextResponse.json(
        {
          error: `An offer that is "${existing.status}" can't become "${input.status}". Allowed: ${
            allowed.join(", ") || "none"
          }.`,
        },
        { status: 409 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.offer.update({
        where: { id },
        data: {
          status: input.status,
          ...(input.status === "sent" && { sentAt: new Date() }),
          ...((input.status === "accepted" || input.status === "rejected") && { respondedAt: new Date() }),
        },
      });

      // Keep the application in step with the offer.
      const nextApplicationStatus =
        input.status === "accepted" ? "offered" : input.status === "rejected" ? "rejected" : null;

      if (nextApplicationStatus && existing.application.status !== nextApplicationStatus) {
        await tx.application.update({
          where: { id: existing.applicationId },
          data: { status: nextApplicationStatus },
        });
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: existing.applicationId,
            fromStatus: existing.application.status,
            toStatus: nextApplicationStatus,
            note: `Offer ${row.code ?? ""} ${input.status}`.trim(),
            actorId: user.id,
          },
        });
      }

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: `offer.${input.status}`,
        entityType: "Offer",
        entityId: id,
        before: { status: existing.status },
        after: { status: row.status, note: input.note },
      });

      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
