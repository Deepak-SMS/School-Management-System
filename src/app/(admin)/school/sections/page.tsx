import { SectionTable } from "@/features/sections/section-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function SectionsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "Sections" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Sections</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage sections within each class.</p>
      </div>
      <SectionTable />
    </div>
  );
}
