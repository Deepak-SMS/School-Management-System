import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { apiError } from "@/lib/api-error";

const accessSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .refine((v) => z.string().email().safeParse(v).success, "Invalid email address"),
  /** Optional starting password; when omitted the account is created without one and must be reset. */
  temporaryPassword: z.string().min(8, "Use at least 8 characters").max(100).optional(),
});

/**
 * Grants or changes a student's portal login.
 *
 * A login is a deliberate act, not a side effect of admitting a student — same
 * reasoning as staff access (see src/app/api/organization/staff/[id]/access/route.ts).
 * The role is always "student", so unlike staff access there is no role choice
 * to make; granting access still requires the stronger `schoolProfile:edit`
 * grant on top of `students:edit`, so an ordinary edit permission can't quietly
 * hand out logins.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("students", "edit");
    await requirePermission("schoolProfile", "edit");

    const { schoolId } = actor;
    const { id } = await params;

    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      select: { id: true, firstName: true, lastName: true, userId: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const input = accessSchema.parse(await request.json());
    const email = input.email.toLowerCase();
    const fullName = `${student.firstName} ${student.lastName}`.trim();

    // An email already used by a different person can't be reassigned here —
    // that would silently move one person's login onto another's record.
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (existingUser?.student && existingUser.student.id !== id) {
      return NextResponse.json(
        {
          error: `${email} is already the login for ${existingUser.student.firstName} ${existingUser.student.lastName}.`,
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name: fullName,
              ...(input.temporaryPassword && {
                passwordHash: hashPassword(input.temporaryPassword),
                mustChangePassword: true,
              }),
            },
          })
        : await tx.user.create({
            data: {
              name: fullName,
              email,
              isActive: true,
              ...(input.temporaryPassword && {
                passwordHash: hashPassword(input.temporaryPassword),
                mustChangePassword: true,
              }),
            },
          });

      await tx.schoolMembership.upsert({
        where: { userId_schoolId: { userId: user.id, schoolId } },
        update: { role: "student" },
        create: { userId: user.id, schoolId, role: "student" },
      });

      if (student.userId !== user.id) {
        await tx.student.update({ where: { id }, data: { userId: user.id } });
      }

      await recordAudit(tx, {
        schoolId,
        userId: actor.id,
        action: "student.portal_access_granted",
        entityType: "Student",
        entityId: id,
        after: { email },
      });

      return { userId: user.id, email };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

/** Revokes portal access without deleting the student or their history. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("students", "edit");
    await requirePermission("schoolProfile", "edit");

    const { schoolId } = actor;
    const { id } = await params;

    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      select: { id: true, userId: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    if (!student.userId) return NextResponse.json({ error: "This student has no login." }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      // Membership and sessions go; the User row stays so audit entries that
      // reference it remain resolvable.
      await tx.schoolMembership.deleteMany({ where: { userId: student.userId!, schoolId } });
      await tx.session.deleteMany({ where: { userId: student.userId! } });
      await tx.student.update({ where: { id }, data: { userId: null } });

      await recordAudit(tx, {
        schoolId,
        userId: actor.id,
        action: "student.portal_access_revoked",
        entityType: "Student",
        entityId: id,
        before: { userId: student.userId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
