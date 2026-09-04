import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { SuperAdminLoginForm } from "@/features/auth/super-admin-login-form";

export const metadata = { title: "Platform administrator login — Classlane" };

export default async function SuperAdminLoginPage() {
  const userId = await getSessionUserId();
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
    if (user?.isSuperAdmin) redirect("/super-admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border-strong bg-surface p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Platform administrator login</h1>
          <p className="mt-1 text-sm text-muted-foreground">Classlane Super Admin — manage every school on the platform.</p>
        </div>
        <Suspense>
          <SuperAdminLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
