import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { PortalFeesView } from "@/features/portal/portal-fees";

export default async function PortalFeesPage() {
  const user = await getCurrentUser();
  // Fees are parent-only in the portal — a student navigating here directly
  // (the nav item itself is already hidden for them) gets sent home rather
  // than an error page.
  if (user.role !== "parent") redirect("/portal");

  return <PortalFeesView />;
}
