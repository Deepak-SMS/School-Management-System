import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { interviewInputSchema, INTERVIEW_DEFAULTS } from "@/lib/validation/recruitment";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { canTransition, InvalidTransitionError } from "@/lib/recruitment-pipeline";
import type { ApplicationStatus } from "@/lib/constants/hr";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("interviews", "view");
    const params = request.nextUrl.searchParams;
    const status = params.get("status") ?? undefined;
    const applicationId = params.get("applicationId") ?? undefined;
    const from = params.get("from");
    const to = params.get("to");

    const where: Prisma.InterviewWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(applicationId && { applicationId }),
      ...((from || to) && {
        scheduledAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) },
      }),
    };

    const data = await prisma.interview.findMany({
      where,
      include: {
        application: {
          select: {
            id: true,
            status: true,
            candidate: { select: { id: true, firstName: true, lastName: true } },
            vacancy: { select: { id: true, title: true, code: true } },
          },
        },
        panel: { include: { staff: { select: { id: true, fullName: true } } } },
        evaluations: { select: { id: true, evaluatorStaffId: true, recommendation: true, overallScore: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("interviews", "create");
    const { schoolId } = user;
    const { panelStaffIds, panelRole, ...input } = cleanEmptyStrings(
      interviewInputSchema.parse(await request.json()),
    );

    const application = await prisma.application.findFirst({
      where: { id: input.applicationId, schoolId },
    });
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    // Scheduling an interview implies the application is at the interview stage.
    const from = application.status as ApplicationStatus;
    if (from !== "interview" && !canTransition(from, "interview")) {
      throw new InvalidTransitionError(from, "interview");
    }

    // Panel members must be staff at this school.
    if (panelStaffIds?.length) {
      const found = await prisma.staff.count({ where: { schoolId, id: { in: panelStaffIds } } });
      if (found !== panelStaffIds.length) {
        return NextResponse.json({ error: "One or more panel members were not found." }, { status: 404 });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      // Rounds number themselves so a second interview doesn't collide with the first.
      const previous = await tx.interview.findFirst({
        where: { applicationId: input.applicationId },
        orderBy: { roundNumber: "desc" },
        select: { roundNumber: true },
      });
      const roundNumber = input.roundNumber ?? (previous?.roundNumber ?? 0) + 1;

      const row = await tx.interview.create({
        data: {
          schoolId,
          ...INTERVIEW_DEFAULTS,
          ...input,
          roundNumber,
          scheduledAt: new Date(input.scheduledAt),
          ...(panelStaffIds?.length && {
            panel: { create: panelStaffIds.map((staffId) => ({ staffId, panelRole })) },
          }),
        },
      });

      if (from !== "interview") {
        await tx.application.update({ where: { id: input.applicationId }, data: { status: "interview" } });
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: input.applicationId,
            fromStatus: from,
            toStatus: "interview",
            note: `Round ${roundNumber} scheduled`,
            actorId: user.id,
          },
        });
      }

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "interview.schedule",
        entityType: "Interview",
        entityId: row.id,
        after: { applicationId: row.applicationId, roundNumber, scheduledAt: row.scheduledAt },
      });

      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
