import { HrDashboard } from "@/features/hr/hr-dashboard";

export default function HrDashboardPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">HR Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live figures from your employee records. Every number links to the list it counts.
        </p>
      </div>
      <HrDashboard />
    </div>
  );
}
