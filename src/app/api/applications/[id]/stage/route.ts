import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applicationStageSchema, screeningInputSchema, selectionInputSchema } from "@/lib/validation/recruitment";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { canTransition, InvalidTransitionError } from "@/lib/recruitment-pipeline";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/constants/hr";
import { apiError } from "@/lib/api-error";

/**
 * Moves an application through the pipeline.
 *
 * All stage changes funnel through this one route so the state machine
 * (src/lib/recruitment-pipeline.ts) is enforced in exactly one place, and every
 * move writes both an audit row and a candidate-visible history entry.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Screening and selection are stage moves with extra payload, so they share
    // this route rather than each re-implementing the transition rules.
    const isScreening = typeof body?.outcome === "string";
    const user = await requirePermission("candidates", isScreening ? "screen" : "select");
    const { schoolId } = user;

    const existing = await prisma.application.findFirst({
      where: { id, schoolId },
      include: { candidate: { select: { firstName: true, lastName: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    const from = existing.status as ApplicationStatus;
    let to: ApplicationStatus;
    let note: string | undefined;
    let extra: Record<string, unknown> = {};

    if (isScreening) {
      const input = cleanEmptyStrings(screeningInputSchema.parse(body));
      to = input.outcome as ApplicationStatus;
      note = input.screeningComments;
      extra = {
        screeningScore: input.screeningScore,
        screeningComments: input.screeningComments,
        screenedAt: new Date(),
        screenedById: user.id,
        ...(input.outcome === "rejected" && { rejectionReason: input.rejectionReason }),
      };
    } else {
      const input = applicationStageSchema.parse(body);
      to = input.status;
      note = input.note;
      if (input.status === "rejected") extra.rejectionReason = input.rejectionReason;

      // Selecting a candidate captures the proposed terms, which is exactly what
      // the offer and the eventual employee record are built from.
      if (input.status === "selected") {
        const selection = cleanEmptyStrings(selectionInputSchema.parse(body));
        extra = {
          ...extra,
          ...selection,
          proposedJoiningDate: selection.proposedJoiningDate ? new Date(selection.proposedJoiningDate) : undefined,
          selectedAt: new Date(),
          selectedById: user.id,
        };
      }
    }

    if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.application.update({ where: { id }, data: { status: to, ...extra } });

      await tx.applicationStatusHistory.create({
        data: { applicationId: id, fromStatus: from, toStatus: to, note, actorId: user.id },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: `application.${to}`,
        entityType: "Application",
        entityId: id,
        before: { status: from },
        after: { status: to, note },
      });

      return row;
    });

    return NextResponse.json({
      ...updated,
      message: `${existing.candidate.firstName} moved to ${APPLICATION_STATUS_LABELS[to]}`,
    });
  } catch (error) {
    return apiError(error);
  }
}
