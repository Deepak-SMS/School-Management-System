import { AcademicYearTable } from "@/features/academic-years/academic-year-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function AcademicYearsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "Academic Years" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Academic Years</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage academic sessions and roll classes forward year to year.</p>
      </div>
      <AcademicYearTable />
    </div>
  );
}
