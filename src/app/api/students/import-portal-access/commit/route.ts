import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { hashPassword, generateTemporaryPassword } from "@/lib/password";
import {
  loadPortalImportContext,
  validatePortalImportRow,
  type PortalImportRowError,
} from "@/lib/students/student-portal-import";
import { apiError } from "@/lib/api-error";

const commitSchema = z.object({
  rows: z
    .array(z.object({ lineNumber: z.number().int(), values: z.record(z.string(), z.string()) }))
    .min(1, "There is nothing to import")
    .max(2000),
});

export interface GrantedCredential {
  admissionNumber: string;
  studentName: string;
  email: string;
  temporaryPassword: string;
}

/**
 * Step 2: grant each row's login.
 *
 * Rows are re-validated against a fresh context rather than trusted from
 * /validate — same reasoning as student-import.ts's commit step. A row whose
 * CSV cell left "Temporary Password" blank gets one generated here
 * (`generateTemporaryPassword()`) and returned in the response — it's never
 * stored in plaintext, and this is the only moment it can be handed to the
 * administrator, same as the single-student grant dialog showing a
 * hand-typed one.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("students", "import");
    await requirePermission("schoolProfile", "edit");
    const { schoolId } = actor;
    const input = commitSchema.parse(await request.json());

    const context = await loadPortalImportContext(schoolId);

    const errors: PortalImportRowError[] = [];
    const seenAdmissionNumbers = new Set<string>();
    const seenEmails = new Set<string>();
    for (const row of input.rows) {
      errors.push(...validatePortalImportRow(row, context, seenAdmissionNumbers, seenEmails));
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "Some rows are no longer valid, so nothing was imported. Re-check the file and try again.",
          errors: errors.slice(0, 100),
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.importJob.create({
        data: {
          schoolId,
          type: "student_portal_access",
          fileName: "student-portal-access-import.csv",
          status: "processing",
          totalRows: input.rows.length,
          createdBy: actor.id,
        },
      });

      const granted: GrantedCredential[] = [];

      for (const row of input.rows) {
        const v = row.values;
        const matched = context.studentsByAdmissionNumber.get(v.admissionNumber.toLowerCase())!;
        const email = v.email.toLowerCase();
        const temporaryPassword = v.temporaryPassword || generateTemporaryPassword();

        const student = await tx.student.findUniqueOrThrow({
          where: { id: matched.id },
          select: { id: true, firstName: true, lastName: true, userId: true },
        });
        const fullName = `${student.firstName} ${student.lastName}`.trim();
        const existingUser = await tx.user.findUnique({ where: { email } });

        const userRow = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: { name: fullName, passwordHash: hashPassword(temporaryPassword), mustChangePassword: true },
            })
          : await tx.user.create({
              data: {
                name: fullName,
                email,
                isActive: true,
                passwordHash: hashPassword(temporaryPassword),
                mustChangePassword: true,
              },
            });

        await tx.schoolMembership.upsert({
          where: { userId_schoolId: { userId: userRow.id, schoolId } },
          update: { role: "student" },
          create: { userId: userRow.id, schoolId, role: "student" },
        });

        if (student.userId !== userRow.id) {
          await tx.student.update({ where: { id: student.id }, data: { userId: userRow.id } });
        }

        granted.push({ admissionNumber: v.admissionNumber, studentName: fullName, email, temporaryPassword });
      }

      await tx.importJob.update({
        where: { id: job.id },
        data: { status: "completed", validRows: granted.length, errorRows: 0, completedAt: new Date() },
      });

      await recordAudit(tx, {
        schoolId,
        userId: actor.id,
        action: "student.portal_access_bulk_granted",
        entityType: "ImportJob",
        entityId: job.id,
        after: { granted: granted.length },
      });

      return { jobId: job.id, granted };
    });

    return NextResponse.json(
      { success: true, jobId: result.jobId, granted: result.granted.length, credentials: result.granted },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
