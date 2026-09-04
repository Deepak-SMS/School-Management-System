import { getCurrentUser } from "@/lib/current-user";
import { TimetablesList } from "@/features/timetable/timetables/timetables-list";
import { MyTimetableView } from "@/features/timetable/my-timetable/my-timetable-view";

export default async function TimetablePage() {
  const user = await getCurrentUser();
  const isTeacher = user.role === "teacher";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{isTeacher ? "My Timetable" : "Timetable"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isTeacher ? "Your weekly schedule." : "Automatic generation, rooms, timing sets, and manual adjustments."}
        </p>
      </div>
      {isTeacher ? <MyTimetableView /> : <TimetablesList />}
    </div>
  );
}
