import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/**
 * Real login sessions, replacing the dev-role placeholder.
 *
 * A random token is set in an httpOnly cookie; only its SHA-256 hash is
 * stored in the `Session` table, so a leaked database row can't be replayed
 * as a valid cookie. `getSessionUserId()` is the one place that reads it —
 * `getCurrentUser()` (src/lib/current-user.ts) and `getCurrentSchoolId()`
 * (src/lib/tenant.ts) both build on top of this.
 */

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class UnauthenticatedError extends Error {
  constructor() {
    super("You must be signed in to do this.");
    this.name = "UnauthenticatedError";
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Resolves the signed-in user id from the session cookie, or null if not signed in. Memoized per request. */
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.userId;
});

/** Same as `getSessionUserId()`, but throws when there is no valid session — for routes/pages that require one. */
export async function requireSessionUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) throw new UnauthenticatedError();
  return userId;
}
