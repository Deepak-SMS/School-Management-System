import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";

/**
 * The generic /admin never stays put — every school has its own branded
 * /{slug}/admin, and the dashboard should always be reached (and bookmarked)
 * through that, not a shared unbranded URL. Falls back to rendering directly
 * only for the rare school with no slug assigned yet.
 */
export default async function DashboardPage() {
  const schoolId = await getCurrentSchoolId();
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { slug: true } });
  if (school?.slug) redirect(`/${school.slug}/admin`);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <DashboardOverview />
    </div>
  );
}
