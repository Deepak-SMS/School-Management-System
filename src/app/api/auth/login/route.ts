import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { LOGIN_ROLE_GROUPS, LOGIN_ROLE_GROUP_LABELS, type Role } from "@/types/user";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  // Set only when signing in through a school's branded /{slug}/admin link.
  // Not a security boundary (the slug isn't secret) — it's a correctness
  // guard so that link never signs someone into the wrong school's account.
  schoolSlug: z.string().trim().optional(),
  // The role tile selected on the login screen. This IS a real boundary
  // (unlike schoolSlug above) — an Admin credential must not sign in through
  // the Teacher tile and vice versa, even though the password is correct.
  loginAs: z.enum(["admin", "teacher", "parent", "student"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, schoolSlug, loginAs } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Same generic message whether the email doesn't exist or the password is
    // wrong — never reveal which one it was.
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    if (!user.isActive) {
      return NextResponse.json({ error: "This account has been deactivated." }, { status: 403 });
    }

    // A correct password isn't enough — the account must still belong to a
    // school. Revoking someone's access removes their membership but keeps the
    // User row so audit entries stay resolvable, and without this check that
    // revoked account would still be issued a valid session.
    const memberships = await prisma.schoolMembership.findMany({
      where: { userId: user.id },
      select: { role: true, school: { select: { slug: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (memberships.length === 0) {
      return NextResponse.json(
        { error: "This account no longer has access to a school. Contact your administrator." },
        { status: 403 },
      );
    }

    if (schoolSlug && !memberships.some((m) => m.school.slug === schoolSlug)) {
      return NextResponse.json(
        { error: "This account isn't linked to this school. Sign in from your own school's link instead." },
        { status: 403 },
      );
    }

    const candidates = schoolSlug ? memberships.filter((m) => m.school.slug === schoolSlug) : memberships;

    // The role tile is a real access boundary, not just a UI hint — a correct
    // password for a Teacher account must still be refused on the Admin tile.
    // A user with more than one membership (e.g. HR at one school, Teacher at
    // another) is matched against whichever of their memberships actually
    // fits the selected tile, not just their first one.
    let resolvedMembership = candidates[0];
    if (loginAs) {
      const allowedRoles = LOGIN_ROLE_GROUPS[loginAs];
      const matched = candidates.find((m) => allowedRoles.includes(m.role as Role));
      if (!matched) {
        return NextResponse.json(
          { error: `This account isn't registered as ${LOGIN_ROLE_GROUP_LABELS[loginAs]}. Select the correct role and try again.` },
          { status: 403 },
        );
      }
      resolvedMembership = matched;
    }

    await createSession(user.id);

    return NextResponse.json({
      mustChangePassword: user.mustChangePassword,
      schoolSlug: resolvedMembership.school.slug,
      role: resolvedMembership.role,
    });
  } catch (error) {
    return apiError(error);
  }
}
