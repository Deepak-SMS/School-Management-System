import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { ASSIGNABLE_ROLES } from "@/config/roles-assignable";
import { apiError } from "@/lib/api-error";

const accessSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES as unknown as [string, ...string[]]),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .refine((v) => z.string().email().safeParse(v).success, "Invalid email address"),
  /** Optional starting password; when omitted the account is created without one and must be reset. */
  temporaryPassword: z.string().min(8, "Use at least 8 characters").max(100).optional(),
});

/**
 * Grants or changes an employee's access.
 *
 * Creating a login is deliberately an explicit action rather than a side effect
 * of adding an employee — most staff never need to sign in, and an account
 * nobody asked for is an account nobody watches.
 *
 * Anyone changing access needs `employees:edit` **and** the school-admin-level
 * grant to manage roles, so an HR user can't quietly promote themselves.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("employees", "edit");
    // Handing out roles is a separate, stronger permission than editing a person.
    await requirePermission("schoolProfile", "edit");

    const { schoolId } = actor;
    const { id } = await params;

    const staff = await prisma.staff.findFirst({
      where: { id, schoolId },
      select: { id: true, fullName: true, userId: true },
    });
    if (!staff) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const input = accessSchema.parse(await request.json());
    const email = input.email.toLowerCase();

    // An email already used by a different person can't be reassigned here —
    // that would silently move one person's login onto another's record.
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { staff: { select: { id: true, fullName: true } } },
    });
    if (existingUser?.staff && existingUser.staff.id !== id) {
      return NextResponse.json(
        { error: `${email} is already the login for ${existingUser.staff.fullName}.` },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name: staff.fullName,
              ...(input.temporaryPassword && {
                passwordHash: hashPassword(input.temporaryPassword),
                mustChangePassword: true,
              }),
            },
          })
        : await tx.user.create({
            data: {
              name: staff.fullName,
              email,
              isActive: true,
              ...(input.temporaryPassword && {
                passwordHash: hashPassword(input.temporaryPassword),
                // A password someone else chose must be replaced on first use.
                mustChangePassword: true,
              }),
            },
          });

      await tx.schoolMembership.upsert({
        where: { userId_schoolId: { userId: user.id, schoolId } },
        update: { role: input.role },
        create: { userId: user.id, schoolId, role: input.role },
      });

      if (staff.userId !== user.id) {
        await tx.staff.update({ where: { id }, data: { userId: user.id } });
      }

      await recordAudit(tx, {
        schoolId,
        userId: actor.id,
        action: "organization.access_granted",
        entityType: "Staff",
        entityId: id,
        after: { email, role: input.role },
      });
      await recordStaffActivity(tx, {
        schoolId,
        staffId: id,
        type: "profile_updated",
        description: `System access set to ${input.role.replace("_", " ")} (${email})`,
        actorId: actor.id,
      });

      return { userId: user.id, email, role: input.role };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

/** Revokes access without deleting the person or their history. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("employees", "edit");
    await requirePermission("schoolProfile", "edit");

    const { schoolId } = actor;
    const { id } = await params;

    const staff = await prisma.staff.findFirst({
      where: { id, schoolId },
      select: { id: true, fullName: true, userId: true },
    });
    if (!staff) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    if (!staff.userId) return NextResponse.json({ error: "This employee has no login." }, { status: 409 });

    if (staff.userId === actor.id) {
      return NextResponse.json({ error: "You can't revoke your own access." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      // Membership and sessions go; the User row stays so audit entries that
      // reference it remain resolvable.
      await tx.schoolMembership.deleteMany({ where: { userId: staff.userId!, schoolId } });
      await tx.session.deleteMany({ where: { userId: staff.userId! } });
      await tx.staff.update({ where: { id }, data: { userId: null } });

      await recordAudit(tx, {
        schoolId,
        userId: actor.id,
        action: "organization.access_revoked",
        entityType: "Staff",
        entityId: id,
        before: { userId: staff.userId },
      });
      await recordStaffActivity(tx, {
        schoolId,
        staffId: id,
        type: "profile_updated",
        description: "System access revoked",
        actorId: actor.id,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
