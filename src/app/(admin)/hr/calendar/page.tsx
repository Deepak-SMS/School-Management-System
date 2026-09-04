import { HolidayCalendar } from "@/features/hr/holiday-calendar";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function WorkCalendarPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "HR & Payroll", href: "/hr" }, { label: "Holiday & Work Calendar" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Holiday &amp; Work Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The days the school is closed, and the days it opens when it normally would not.
        </p>
      </div>
      <HolidayCalendar />
    </div>
  );
}
