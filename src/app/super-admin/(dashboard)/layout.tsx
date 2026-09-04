import { redirect } from "next/navigation";
import { requireSuperAdmin, NotSuperAdminError } from "@/lib/platform-auth";
import { UnauthenticatedError } from "@/lib/session";
import { PlatformShell } from "@/layouts/platform-shell";

export default async function PlatformDashboardLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch (error) {
    if (error instanceof UnauthenticatedError || error instanceof NotSuperAdminError) {
      redirect("/super-admin/login");
    }
    throw error;
  }

  return <PlatformShell user={user}>{children}</PlatformShell>;
}
