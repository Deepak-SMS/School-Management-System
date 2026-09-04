import { Breadcrumb } from "@/components/ui/breadcrumb";
import { RoomsManager } from "@/features/timetable/rooms/rooms-manager";

export default function TimetableRoomsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Timetable", href: "/academics/timetable" }, { label: "Rooms" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Rooms</h1>
        <p className="mt-1 text-sm text-muted-foreground">Classrooms and labs the generator can assign.</p>
      </div>
      <RoomsManager />
    </div>
  );
}
