import { DepartmentTable } from "@/features/departments/department-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function DepartmentsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "School Management", href: "/school/profile" }, { label: "Departments" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Departments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organize academic and administrative departments across your school.</p>
      </div>
      <DepartmentTable />
    </div>
  );
}
