"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useActiveChild } from "@/providers/active-child-provider";
import { portalService } from "@/services/portalService";
import type { PortalFeeAccount } from "@/types/portal";

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const statusVariant: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  paid: "success",
  pending: "neutral",
  overdue: "danger",
  partially_paid: "warning",
  waived: "neutral",
};

export function PortalFeesView() {
  const { activeChild, isLoading: childLoading } = useActiveChild();
  const [account, setAccount] = useState<PortalFeeAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!activeChild) return;
    setLoading(true);
    setError(null);
    portalService
      .getFees(activeChild.id)
      .then(setAccount)
      .catch(() => setError("Couldn't load fees."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (childLoading) return;
    const timeout = setTimeout(() => {
      if (!activeChild) {
        setLoading(false);
        return;
      }
      load();
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChild?.id, childLoading]);

  if (childLoading || loading) return <LoadingState />;
  if (!activeChild) return <EmptyState title="No student linked to this account yet" />;
  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!account) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Fees</h1>
        <p className="mt-1 text-sm text-muted-foreground">{activeChild.firstName}&apos;s fee account.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total charged</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{formatInr(account.summary.totalCharged)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Paid</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{formatInr(account.summary.totalPaid)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Pending</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{formatInr(account.summary.totalPending)}</p>
        </Card>
      </div>

      {account.summary.totalOverdue > 0 && (
        <Card className="border-danger-200 bg-danger-50/50 p-4 text-sm text-danger-700">
          {formatInr(account.summary.totalOverdue)} overdue — contact your school office to pay.
        </Card>
      )}

      {account.charges.length === 0 ? (
        <EmptyState title="No fee charges on file" />
      ) : (
        <Card className="divide-y divide-border p-0">
          {account.charges.map((charge) => (
            <div key={charge.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{charge.label}</p>
                {charge.dueDate && (
                  <p className="text-xs text-muted-foreground">
                    Due {new Date(charge.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm text-foreground">{formatInr(charge.outstandingAmount)}</span>
                <Badge variant={statusVariant[charge.status] ?? "neutral"}>{charge.status.replace("_", " ")}</Badge>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
