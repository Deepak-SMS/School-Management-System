import { Breadcrumb } from "@/components/ui/breadcrumb";
import { TeacherAvailabilityManager } from "@/features/timetable/teacher-availability/teacher-availability-manager";

export default function TeacherAvailabilityPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Timetable", href: "/academics/timetable" }, { label: "Teacher Availability" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Teacher Availability</h1>
        <p className="mt-1 text-sm text-muted-foreground">Blackout days/periods and workload caps the generator must respect.</p>
      </div>
      <TeacherAvailabilityManager />
    </div>
  );
}
