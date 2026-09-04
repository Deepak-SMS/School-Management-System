"use client";

import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CreateTimetableForm } from "@/features/timetable/timetables/create-timetable-form";

export default function NewTimetablePage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Timetable", href: "/academics/timetable" }, { label: "Create Timetable" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Create Timetable</h1>
      </div>
      <CreateTimetableForm onCreated={(id) => router.push(`/academics/timetable/${id}`)} />
    </div>
  );
}
