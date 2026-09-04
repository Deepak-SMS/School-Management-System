import { Breadcrumb } from "@/components/ui/breadcrumb";
import { TimingSetsManager } from "@/features/timetable/timing-sets/timing-sets-manager";

export default function TimetableTimingSetsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Timetable", href: "/academics/timetable" }, { label: "Timing Sets" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Timing Sets</h1>
        <p className="mt-1 text-sm text-muted-foreground">Period timings a timetable can use — different wings can run different timings.</p>
      </div>
      <TimingSetsManager />
    </div>
  );
}
