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
 * Grants or changes a guardian's portal login.
 *
 * Same shape as student portal access (see
 * src/app/api/students/[id]/portal-access/route.ts) and staff access — the
 * role is always "parent", and granting it requires the stronger
 * `schoolProfile:edit` grant on top of `guardians:edit`.
 *
 * Note this grants the *login* only. Which of the guardian's children they can
 * actually see in the portal is controlled separately, per child, by
 * StudentGuardian.canAccessPortal — see /api/student-guardians/[id].
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("guardians", "edit");
    await requirePermission("schoolProfile", "edit");

    const { schoolId } = actor;
    const { id } = await params;

    const guardian = await prisma.guardian.findFirst({
      where: { id, schoolId },
      select: { id: true, fullName: true, userId: true },
    });
    if (!guardian) return NextResponse.json({ error: "Guardian not found." }, { status: 404 });

    const input = accessSchema.parse(await request.json());
    const email = input.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { guardian: { select: { id: true, fullName: true } } },
    });
    if (existingUser?.guardian && existingUser.guardian.id !== id) {
      return NextResponse.json(
        { error: `${email} is already the login for ${existingUser.guardian.fullName}.` },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name: guardian.fullName,
              ...(input.temporaryPassword && {
                passwordHash: hashPassword(input.temporaryPassword),
                mustChangePassword: true,
              }),
            },
          })
        : await tx.user.create({
            data: {
              name: guardian.fullName,
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
        update: { role: "parent" },
        create: { userId: user.id, schoolId, role: "parent" },
      });

      if (guardian.userId !== user.id) {
        await tx.guardian.update({ where: { id }, data: { userId: user.id } });
      }

      await recordAudit(tx, {
        schoolId,
        userId: actor.id,
        action: "guardian.portal_access_granted",
        entityType: "Guardian",
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

/** Revokes portal access without deleting the guardian or their history. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("guardians", "edit");
    await requirePermission("schoolProfile", "edit");

    const { schoolId } = actor;
    const { id } = await params;

    const guardian = await prisma.guardian.findFirst({
      where: { id, schoolId },
      select: { id: true, userId: true },
    });
    if (!guardian) return NextResponse.json({ error: "Guardian not found." }, { status: 404 });
    if (!guardian.userId) return NextResponse.json({ error: "This guardian has no login." }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.schoolMembership.deleteMany({ where: { userId: guardian.userId!, schoolId } });
      await tx.session.deleteMany({ where: { userId: guardian.userId! } });
      await tx.guardian.update({ where: { id }, data: { userId: null } });

      await recordAudit(tx, {
        schoolId,
        userId: actor.id,
        action: "guardian.portal_access_revoked",
        entityType: "Guardian",
        entityId: id,
        before: { userId: guardian.userId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
