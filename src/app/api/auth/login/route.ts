import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { apiError } from "@/lib/api-error";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

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
    const membershipCount = await prisma.schoolMembership.count({ where: { userId: user.id } });
    if (membershipCount === 0) {
      return NextResponse.json(
        { error: "This account no longer has access to a school. Contact your administrator." },
        { status: 403 },
      );
    }

    await createSession(user.id);
    return NextResponse.json({ mustChangePassword: user.mustChangePassword });
  } catch (error) {
    return apiError(error);
  }
}
