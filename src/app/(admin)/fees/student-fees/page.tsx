import { StudentFeeTable } from "@/features/student-fees/student-fee-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function StudentFeesPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Fees & Finance", href: "/fees/structure" }, { label: "Student Fees" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Student Fees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every student&apos;s individual fee account — payable, paid, pending and overdue amounts, calculated from
          their assigned fee structures.
        </p>
      </div>
      <StudentFeeTable />
    </div>
  );
}
