import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { interviewEvaluationSchema } from "@/lib/validation/recruitment";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Records one panel member's scorecard.
 *
 * Scores inform the decision; they never make it. The interview's `outcome`
 * stays null until a person sets it, and converting a candidate remains a
 * separate, explicitly-permissioned action (spec §3.11).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("interviews", "evaluate");
    const { schoolId } = user;
    const { id } = await params;

    const interview = await prisma.interview.findFirst({
      where: { id, schoolId },
      include: { panel: { select: { staffId: true } } },
    });
    if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });

    const input = interviewEvaluationSchema.parse(await request.json());

    // The evaluator is the acting user's own staff record — an evaluation must be
    // attributable to a real person, not submitted on someone else's behalf.
    const evaluator = user.id
      ? await prisma.staff.findFirst({
          where: { schoolId, OR: [{ email: { not: null } }, { id: user.id }] },
          select: { id: true },
        })
      : null;

    const evaluatorStaffId = evaluator?.id ?? interview.panel[0]?.staffId;
    if (!evaluatorStaffId) {
      return NextResponse.json(
        { error: "No panel member is set for this interview, so an evaluation can't be attributed." },
        { status: 409 },
      );
    }

    const saved = await prisma.$transaction(async (tx) => {
      // One scorecard per evaluator per interview — resubmitting revises it.
      const row = await tx.interviewEvaluation.upsert({
        where: { interviewId_evaluatorStaffId: { interviewId: id, evaluatorStaffId } },
        create: {
          interviewId: id,
          evaluatorStaffId,
          scoresJson: input.scores ? JSON.stringify(input.scores) : undefined,
          overallScore: input.overallScore,
          recommendation: input.recommendation,
          comments: input.comments,
        },
        update: {
          scoresJson: input.scores ? JSON.stringify(input.scores) : undefined,
          overallScore: input.overallScore,
          recommendation: input.recommendation,
          comments: input.comments,
          submittedAt: new Date(),
        },
      });

      // Keep the interview's headline score as the mean of submitted scorecards,
      // so a multi-panel round reads at a glance.
      const all = await tx.interviewEvaluation.findMany({
        where: { interviewId: id },
        select: { overallScore: true },
      });
      const scored = all.map((e) => e.overallScore).filter((s): s is number => typeof s === "number");
      const mean = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;

      await tx.interview.update({
        where: { id },
        data: { overallScore: mean, status: "completed" },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "interview.evaluate",
        entityType: "InterviewEvaluation",
        entityId: row.id,
        after: { interviewId: id, recommendation: row.recommendation, overallScore: row.overallScore },
      });

      return row;
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
