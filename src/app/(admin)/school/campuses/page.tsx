import { CampusTable } from "@/features/campuses/campus-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function CampusesPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "Campuses" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Campuses</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage every physical campus operated by your school.</p>
      </div>
      <CampusTable />
    </div>
  );
}
