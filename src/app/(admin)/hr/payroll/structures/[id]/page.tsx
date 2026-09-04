"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { salaryStructureService } from "@/services/payrollService";
import { SalaryStructureDetail } from "@/features/payroll/salary-structure-detail";
import type { SalaryStructureRecord } from "@/types/payroll";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

export default function SalaryStructureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [structure, setStructure] = useState<SalaryStructureRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    salaryStructureService.get(id).then(setStructure).catch(() => setError(true));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-4xl px-6 py-16" onRetry={load} />;
  if (!structure) return <LoadingState className="mx-auto max-w-4xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "HR & Payroll", href: "/hr" },
            { label: "Payroll", href: "/hr/payroll" },
            { label: "Salary Structures", href: "/hr/payroll/structures" },
            { label: structure.name },
          ]}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{structure.name}</h1>
            <Badge variant={structure.status === "active" ? "success" : "neutral"}>{structure.status}</Badge>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/hr/payroll/structures/${id}/edit`}>
              <Pencil className="size-4" /> Edit
            </Link>
          </Button>
        </div>
        {structure.description && <p className="mt-1 text-sm text-muted-foreground">{structure.description}</p>}
      </div>

      <Link href="/hr/payroll/structures" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All structures
      </Link>

      <SalaryStructureDetail structure={structure} onReload={load} />
    </div>
  );
}
