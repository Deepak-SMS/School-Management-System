import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authorize";
import { loadTimetableDetail } from "@/lib/timetable/load-timetable-detail";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { TimetableDetail } from "@/features/timetable/timetables/timetable-detail";

export default async function TimetableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { schoolId } = await requirePermission("timetable", "view");
  const timetable = await loadTimetableDetail(id, schoolId);
  if (!timetable) notFound();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Timetable", href: "/academics/timetable" }, { label: timetable.name }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">{timetable.name}</h1>
      </div>
      <TimetableDetail timetable={timetable} />
    </div>
  );
}
