import { ClassTable } from "@/features/classes/class-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function ClassesPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "Classes" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Classes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage classes across campuses and academic years.</p>
      </div>
      <ClassTable />
    </div>
  );
}
