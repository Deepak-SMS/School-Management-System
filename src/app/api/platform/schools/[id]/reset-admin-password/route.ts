import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/platform-auth";
import { hashPassword, generateTemporaryPassword } from "@/lib/password";
import { recordPlatformAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { CreatedSchoolAdmin } from "@/types/platform";

/**
 * Issues a fresh temporary password for a school's admin login.
 *
 * The original password is never stored in a retrievable form (only its hash
 * is kept — see src/lib/password.ts), so "I lost the credentials I was shown
 * at school creation" has exactly one fix: generate a new one, the same way
 * the school was created in the first place. Existing sessions for that login
 * are revoked so the old password can't keep working after this.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;

    const membership = await prisma.schoolMembership.findFirst({
      where: { schoolId: id, role: "school_admin" },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      return NextResponse.json({ error: "This school has no admin login yet." }, { status: 404 });
    }

    const temporaryPassword = generateTemporaryPassword();

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: membership.user.id },
        data: { passwordHash: hashPassword(temporaryPassword), mustChangePassword: true },
      });
      await tx.session.deleteMany({ where: { userId: membership.user.id } });
      await recordPlatformAudit(tx, {
        actorUserId: actor.id,
        action: "school.admin_password_reset",
        targetSchoolId: id,
        metadata: { adminEmail: membership.user.email },
      });
    });

    const admin: CreatedSchoolAdmin = { name: membership.user.name, email: membership.user.email, temporaryPassword };
    return NextResponse.json({ admin });
  } catch (error) {
    return apiError(error);
  }
}
