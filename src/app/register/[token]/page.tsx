import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PublicRegistrationForm } from "@/features/students/public-registration-form";

/**
 * The parent-facing admission form. Deliberately outside the (admin) route group
 * so it has no sidebar, no session requirement, and no access to school data
 * beyond what this page passes down.
 *
 * The token is resolved server-side; an unknown, revoked or expired token 404s
 * identically so the URL space can't be probed.
 */
export default async function PublicRegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Expiry is compared in the query rather than during render: reading the clock
  // while rendering is impure, and letting the database do it keeps the check in
  // one place alongside the API route's own.
  const form = await prisma.registrationForm.findFirst({
    where: {
      token,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    select: {
      title: true,
      description: true,
      school: { select: { name: true } },
    },
  });

  // Unknown, revoked and expired tokens all 404 identically, so the URL space
  // can't be probed for which links exist.
  if (!form) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-primary-600">{form.school.name}</p>
        <h1 className="text-2xl font-semibold text-foreground">{form.title}</h1>
        {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
      </header>

      <PublicRegistrationForm token={token} />

      <p className="text-xs text-muted-foreground">
        Your details go to the school for review. Submitting this form does not confirm admission.
      </p>
    </main>
  );
}
