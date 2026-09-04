import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { LoginForm } from "@/features/auth/login-form";
import { AppShell } from "@/layouts/app-shell";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";

interface PageProps {
  params: Promise<{ schoolSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { schoolSlug } = await params;
  const school = await prisma.school.findUnique({ where: { slug: schoolSlug }, select: { name: true } });
  return { title: school ? `Sign in — ${school.name}` : "Sign in — Classlane" };
}

/**
 * A school's branded login link (/{shortName}/admin). The slug isn't a
 * secret and doesn't gate access by itself — anyone can still find /login —
 * it exists so a school can hand out one memorable URL, and so signing in
 * through it can only ever succeed for an account actually linked to this
 * school (enforced server-side in /api/auth/login), not as a security wall.
 */
export default async function SchoolAdminLoginPage({ params }: PageProps) {
  const { schoolSlug } = await params;
  const school = await prisma.school.findUnique({
    where: { slug: schoolSlug },
    select: { id: true, name: true, logoUrl: true },
  });
  if (!school) notFound();

  const userId = await getSessionUserId();
  if (userId) {
    const membership = await prisma.schoolMembership.findFirst({
      where: { userId, schoolId: school.id },
      select: { id: true },
    });
    // Already signed in to this school: render the dashboard right here so the
    // branded link's URL sticks, instead of bouncing to the generic /admin.
    if (membership) {
      return (
        <AppShell>
          <div className="mx-auto max-w-7xl px-6 py-8">
            <DashboardOverview />
          </div>
        </AppShell>
      );
    }
    // Signed in, but to a different school than this link belongs to — fall
    // through to the login form below rather than showing their other school's data.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border-strong bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {school.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logoUrl} alt="" className="mb-3 size-14 rounded object-contain" />
          )}
          <h1 className="text-lg font-semibold text-foreground">Sign in to {school.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the login your school administrator gave you.</p>
        </div>
        <Suspense>
          <LoginForm schoolSlug={schoolSlug} />
        </Suspense>
      </div>
    </div>
  );
}
