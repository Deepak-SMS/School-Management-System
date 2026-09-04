"use client";

import { useRouter } from "next/navigation";
import { ExpenseForm } from "@/features/finance/expense-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewExpensePage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Fees & Finance", href: "/fees/structure" },
            { label: "Expenses", href: "/finance/expenses" },
            { label: "Record expense" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Record expense</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved as a draft. Attach the bill, then send it for approval.
        </p>
      </div>
      <ExpenseForm
        onSaved={(expense) => {
          toast({ title: "Draft saved", description: expense.expenseNumber, variant: "success" });
          router.push(`/finance/expenses/${expense.id}`);
        }}
      />
    </div>
  );
}
