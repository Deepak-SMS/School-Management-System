import { SalaryStructureTable } from "@/features/payroll/salary-structure-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function SalaryStructuresPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "HR & Payroll", href: "/hr" }, { label: "Payroll", href: "/hr/payroll" }, { label: "Salary Structures" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Salary Structures</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bundle components into a pay structure, then assign staff to it.</p>
      </div>
      <SalaryStructureTable />
    </div>
  );
}
