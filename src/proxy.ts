import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic auth redirect (Next.js 16 renamed `middleware.ts` to `proxy.ts` —
 * see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 *
 * This only checks whether the session cookie is present, to bounce
 * unauthenticated visitors to /login before a protected page even renders.
 * It is NOT the real authorization boundary — Proxy shouldn't do a database
 * lookup on every request. The actual check (is this a *valid, unexpired*
 * session, and is this user allowed to see this data) happens where it
 * already does in this codebase: `getCurrentUser()` / `requirePermission()`
 * in layouts and API routes.
 */

const SESSION_COOKIE = "session";

/**
 * Paths that must stay reachable without a session.
 *
 * `/register` and `/api/public` are the parent-facing admission form: the whole
 * point is that a parent with the link can fill it in without an account. They
 * are safe to expose because the link carries an unguessable token, the routes
 * resolve the school from that token rather than from a session, and a
 * submission only ever creates a `pending` StudentRegistration — never a student.
 */
const PUBLIC_PATH_PREFIXES = ["/login", "/api/auth", "/verify", "/register", "/api/public"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
