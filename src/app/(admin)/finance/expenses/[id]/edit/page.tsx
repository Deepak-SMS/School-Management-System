"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpenseForm } from "@/features/finance/expense-form";
import { expenseService, type ExpenseRecord } from "@/services/expenseService";
import { isEditable } from "@/lib/finance/expense-workflow";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    expenseService
      .get(id)
      .then((e) => {
        setExpense(e);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-4xl px-6 py-16" onRetry={load} />;
  if (!expense) return <LoadingState className="mx-auto max-w-4xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Fees & Finance", href: "/fees/structure" },
            { label: "Expenses", href: "/finance/expenses" },
            { label: expense.expenseNumber, href: `/finance/expenses/${id}` },
            { label: "Edit" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit expense</h1>
      </div>

      {/* The server refuses the edit too; this explains why rather than letting
          the form fail on save. */}
      {!isEditable(expense.status) ? (
        <Alert variant="warning" title={`This expense is ${expense.status}`}>
          It can no longer be edited — that&apos;s what makes an approval mean something. Cancel it and raise a new one if
          it&apos;s wrong.
        </Alert>
      ) : (
        <ExpenseForm
          expense={expense}
          submitLabel="Save changes"
          onSaved={() => {
            toast({ title: "Expense updated", variant: "success" });
            router.push(`/finance/expenses/${id}`);
          }}
        />
      )}
    </div>
  );
}
