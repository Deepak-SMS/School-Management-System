import { SalarySlipTable } from "@/features/payroll/salary-slip-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function SalarySlipsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "HR & Payroll", href: "/hr" }, { label: "Salary Slips" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Salary Slips</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every salary slip ever generated, across all payroll periods.</p>
      </div>
      <SalarySlipTable />
    </div>
  );
}
