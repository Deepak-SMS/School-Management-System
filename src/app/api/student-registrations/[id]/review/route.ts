import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { registrationReviewSchema } from "@/lib/validation/student-registration";
import { validateStudentPlacement, createStudentWithGuardians } from "@/lib/students/create-student";
import { TERMINAL_APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/constants/admissions";
import { apiError } from "@/lib/api-error";

/**
 * Approves or rejects a parent-submitted admission form.
 *
 * Approval is where untrusted input finally becomes a real record. The
 * reviewer submits the same full student form used to add one directly
 * (pre-filled from the submission, but theirs to edit) — so this writes the
 * student exactly the way that path does, and the submission's raw payload is
 * never trusted directly.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("studentRegistrations", "approve");
    const { schoolId } = user;
    const { id } = await params;

    const submission = await prisma.studentRegistration.findFirst({ where: { id, schoolId } });
    if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

    // Reviewable from any in-progress status — pending, under review,
    // shortlisted, waitlisted — not just fresh submissions. Only a status
    // this route itself set (approved/rejected) or a staff withdrawal is closed.
    if (TERMINAL_APPLICATION_STATUSES.includes(submission.status as ApplicationStatus)) {
      return NextResponse.json(
        { error: `This submission was already ${submission.status}.` },
        { status: 409 },
      );
    }

    const input = registrationReviewSchema.parse(await request.json());

    if (input.action === "reject") {
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.studentRegistration.update({
          where: { id },
          data: { status: "rejected", reviewNote: input.reviewNote, reviewedById: user.id, reviewedAt: new Date() },
        });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "studentRegistration.reject",
          entityType: "StudentRegistration",
          entityId: id,
          before: { status: "pending" },
          after: { status: "rejected", reviewNote: input.reviewNote },
        });
        return row;
      });
      return NextResponse.json({ success: true, status: updated.status });
    }

    // --- Approval ---
    // `input` is the full student record the reviewer completed (pre-filled
    // from the submission, but theirs to edit) — never the raw submission.
    // `action` is stripped out here — it drove which schema branch matched,
    // but isn't a Student field, so it can't ride along into the create call.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action: _action, reviewNote, ...studentInput } = input;

    await validateStudentPlacement(schoolId, studentInput);

    const student = await prisma.$transaction(async (tx) => {
      const created = await createStudentWithGuardians(tx, schoolId, user.id, studentInput, "studentRegistration.approve");

      await tx.studentRegistration.update({
        where: { id },
        data: {
          status: "approved",
          reviewNote,
          reviewedById: user.id,
          reviewedAt: new Date(),
          studentId: created.id,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "studentRegistration.approve",
        entityType: "StudentRegistration",
        entityId: id,
        before: { status: "pending" },
        after: { studentId: created.id, admissionNumber: created.admissionNumber },
      });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        status: "approved",
        studentId: student.id,
        admissionNumber: student.admissionNumber,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
