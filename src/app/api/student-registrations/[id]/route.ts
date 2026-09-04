import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import {
  APPLICATION_TRANSITION_STATUSES,
  TERMINAL_APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/constants/admissions";
import { apiError } from "@/lib/api-error";

const statusUpdateSchema = z.object({
  status: z.enum(APPLICATION_TRANSITION_STATUSES),
});

/**
 * Moves an application between the in-progress statuses (under review,
 * shortlisted, waitlisted, withdrawn) without deciding it — deciding is
 * `[id]/review`, which is the only route allowed to set `approved`/`rejected`
 * because approving also creates the student record.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("studentRegistrations", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const { status } = statusUpdateSchema.parse(await request.json());

    const submission = await prisma.studentRegistration.findFirst({ where: { id, schoolId } });
    if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

    if (TERMINAL_APPLICATION_STATUSES.includes(submission.status as ApplicationStatus)) {
      return NextResponse.json(
        { error: `This submission was already ${submission.status} and can't be moved further.` },
        { status: 409 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.studentRegistration.update({ where: { id }, data: { status } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "studentRegistration.statusChange",
        entityType: "StudentRegistration",
        entityId: id,
        before: { status: submission.status },
        after: { status },
      });
      return row;
    });

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    return apiError(error);
  }
}
