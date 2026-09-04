import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AttendanceDashboard } from "@/features/attendance/attendance-dashboard";

export default function AttendanceDashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Attendance" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Today&apos;s figures, the weekly trend, and every class&apos;s status at a glance.</p>
      </div>
      <AttendanceDashboard />
    </div>
  );
}
