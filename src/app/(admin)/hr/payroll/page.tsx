import Link from "next/link";
import { PayrollPeriodTable } from "@/features/payroll/payroll-period-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

export default function PayrollPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Breadcrumb items={[{ label: "HR & Payroll", href: "/hr" }, { label: "Payroll" }]} />
          <h1 className="mt-2 text-xl font-semibold text-foreground">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">Run payroll month by month — calculate, approve, lock, and generate salary slips.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/hr/payroll/structures">Salary Structures</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/hr/payroll/components">Components</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/hr/payroll/rules">Rules</Link>
          </Button>
        </div>
      </div>
      <PayrollPeriodTable />
    </div>
  );
}
