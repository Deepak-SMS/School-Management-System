import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AttendanceReports } from "@/features/attendance/attendance-reports";

export default function AttendanceReportsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Attendance", href: "/academics/attendance" }, { label: "Class Report" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Class Report</h1>
        <p className="mt-1 text-sm text-muted-foreground">Per-student attendance over a date range, for any class and section.</p>
      </div>
      <AttendanceReports />
    </div>
  );
}
