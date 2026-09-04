import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isReservedSlug } from "@/lib/slug";

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
 * `/` is the public marketing site (src/app/page.tsx) — signed-in users land on
 * `/dashboard` instead, which stays behind the session check below.
 *
 * `/register` and `/api/public` are the parent-facing admission form: the whole
 * point is that a parent with the link can fill it in without an account. They
 * are safe to expose because the link carries an unguessable token, the routes
 * resolve the school from that token rather than from a session, and a
 * submission only ever creates a `pending` StudentRegistration — never a student.
 */
const PUBLIC_PATHS = ["/"];
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/super-admin/login",
  "/api/auth",
  "/verify",
  "/verify-certificate",
  "/register",
  "/api/public",
];

/**
 * `/{schoolSlug}/admin` — a school's branded login link (see
 * src/app/[schoolSlug]/admin). Public for the same reason /login is: it only
 * ever renders a sign-in form, never account data. `isReservedSlug` keeps
 * this from ever shadowing one of the app's own top-level routes.
 */
function isSchoolAdminLoginPath(pathname: string): boolean {
  const match = pathname.match(/^\/([^/]+)\/admin\/?$/);
  return match !== null && !isReservedSlug(match[1]);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    isSchoolAdminLoginPath(pathname)
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
