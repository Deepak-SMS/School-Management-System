import { LeaveManager } from "@/features/hr/leave-manager";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function LeaveManagementPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "HR & Payroll", href: "/hr" }, { label: "Leave Management" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Leave Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approving leave writes the attendance behind it, so the two never disagree at payroll time.
        </p>
      </div>
      <LeaveManager />
    </div>
  );
}
