import { SalaryComponentManager } from "@/features/payroll/salary-component-manager";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function SalaryComponentsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "HR & Payroll", href: "/hr" }, { label: "Payroll", href: "/hr/payroll" }, { label: "Salary Components" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Salary Components</h1>
        <p className="mt-1 text-sm text-muted-foreground">Basic, HRA, PF — the building blocks every salary structure is assembled from.</p>
      </div>
      <SalaryComponentManager />
    </div>
  );
}
