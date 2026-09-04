"use client";

import { use, useEffect, useState } from "react";
import { payrollPeriodService } from "@/services/payrollService";
import { PayrollPeriodDetailView } from "@/features/payroll/payroll-period-detail";
import type { PayrollPeriodDetail } from "@/types/payroll";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function PayrollPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [period, setPeriod] = useState<PayrollPeriodDetail | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    payrollPeriodService.get(id).then(setPeriod).catch(() => setError(true));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-5xl px-6 py-16" onRetry={load} />;
  if (!period) return <LoadingState className="mx-auto max-w-5xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "HR & Payroll", href: "/hr" }, { label: "Payroll", href: "/hr/payroll" }, { label: `${MONTH_NAMES[period.month - 1]} ${period.year}` }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          {MONTH_NAMES[period.month - 1]} {period.year}
        </h1>
      </div>
      <PayrollPeriodDetailView period={period} onReload={load} />
    </div>
  );
}
