import { School, CheckCircle2, Clock, GraduationCap, Users } from "lucide-react";
import { getPlatformStats } from "@/lib/platform-stats";
import { StatCard } from "@/components/ui/stat-card";

export default async function PlatformDashboardPage() {
  const stats = await getPlatformStats();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Platform Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening across your school network.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Schools" value={stats.totalSchools} icon={School} tone="primary" />
        <StatCard label="Active" value={stats.activeSchools} icon={CheckCircle2} tone="success" />
        <StatCard label="Trial" value={stats.trialSchools} icon={Clock} tone="warning" />
        <StatCard label="Total Students" value={stats.totalStudents.toLocaleString()} icon={GraduationCap} tone="neutral" />
        <StatCard label="Total Staff" value={stats.totalStaff.toLocaleString()} icon={Users} tone="neutral" />
      </div>
    </div>
  );
}
