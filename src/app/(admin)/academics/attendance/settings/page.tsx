import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AttendanceSettingsForm } from "@/features/attendance/attendance-settings-form";

export default function AttendanceSettingsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Attendance", href: "/academics/attendance" }, { label: "Settings" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Attendance Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Defaulter thresholds and which optional statuses markers can choose.</p>
      </div>
      <AttendanceSettingsForm />
    </div>
  );
}
