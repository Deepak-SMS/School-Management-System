import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AttendanceDefaulters } from "@/features/attendance/attendance-defaulters";

export default function AttendanceDefaultersPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Attendance", href: "/academics/attendance" }, { label: "Defaulters" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Attendance Defaulters</h1>
        <p className="mt-1 text-sm text-muted-foreground">Active students below the warning threshold, worst first.</p>
      </div>
      <AttendanceDefaulters />
    </div>
  );
}
