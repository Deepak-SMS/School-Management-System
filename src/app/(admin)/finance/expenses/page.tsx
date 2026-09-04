import { ExpenseTable } from "@/features/finance/expense-table";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function ExpensesPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Fees & Finance", href: "/fees/structure" }, { label: "Expenses" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Expenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What the school spends — raised by staff, approved by those authorised to sign it off.
        </p>
      </div>
      <ExpenseTable />
    </div>
  );
}
