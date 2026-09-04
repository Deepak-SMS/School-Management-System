import { AttendanceSheet } from "@/features/hr/attendance-sheet";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function EmployeeAttendancePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "HR & Payroll", href: "/hr" }, { label: "Employee Attendance" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Employee Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mark the day, then lock the month so payroll runs against figures that can&apos;t move under it.
        </p>
      </div>
      <AttendanceSheet />
    </div>
  );
}
