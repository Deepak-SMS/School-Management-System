import { SubjectTable } from "@/features/subjects/subject-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function SubjectsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "Subjects" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Subjects</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage subjects and assign them to classes, sections, and teachers.</p>
      </div>
      <SubjectTable />
    </div>
  );
}
