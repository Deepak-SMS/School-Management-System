import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { AppShell } from "@/layouts/app-shell";
import { isPortalRole } from "@/types/user";
import type { Role } from "@/types/user";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  // A session alone isn't enough to render this shell — it assumes exactly
  // one active school membership (TenantProvider/SidebarProvider, Sidebar's
  // useCurrentUser()). A Super Admin has none by design (see
  // src/lib/platform-auth.ts) and belongs in the platform shell instead; any
  // other zero-membership session (e.g. revoked access) has nowhere to go
  // but back to /login.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  if (user?.isSuperAdmin) redirect("/super-admin");

  const membership = await prisma.schoolMembership.findFirst({ where: { userId }, select: { role: true } });
  if (!membership) redirect("/login");

  // A parent/student login belongs in the lighter portal shell, not here —
  // its nav, providers, and permission grants all assume the admin surface.
  if (isPortalRole(membership.role as Role)) redirect("/portal");

  return <AppShell>{children}</AppShell>;
}
