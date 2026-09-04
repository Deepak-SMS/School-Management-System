import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AttendanceCalendar } from "@/features/attendance/attendance-calendar";

export default function AttendanceCalendarPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Attendance", href: "/academics/attendance" }, { label: "Student Calendar" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Student Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">A student&apos;s daily attendance, month by month.</p>
      </div>
      <AttendanceCalendar />
    </div>
  );
}
