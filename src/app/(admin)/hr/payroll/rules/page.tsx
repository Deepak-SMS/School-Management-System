import { PayrollRuleManager } from "@/features/payroll/payroll-rule-manager";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function PayrollRulesPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "HR & Payroll", href: "/hr" }, { label: "Payroll", href: "/hr/payroll" }, { label: "Payroll Rules" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Payroll Rules</h1>
        <p className="mt-1 text-sm text-muted-foreground">PF, ESI, Professional Tax and TDS rates, versioned by effective date.</p>
      </div>
      <PayrollRuleManager />
    </div>
  );
}
