import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { PortalShell } from "@/layouts/portal-shell";
import { isPortalRole } from "@/types/user";
import type { Role } from "@/types/user";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  if (user?.isSuperAdmin) redirect("/super-admin");

  const membership = await prisma.schoolMembership.findFirst({ where: { userId }, select: { role: true } });
  if (!membership) redirect("/login");

  // Staff logins belong in the admin shell — its nav/permissions don't apply here.
  if (!isPortalRole(membership.role as Role)) redirect("/admin");

  return <PortalShell>{children}</PortalShell>;
}
