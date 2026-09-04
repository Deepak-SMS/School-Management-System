"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { salaryStructureService } from "@/services/payrollService";
import { SalaryStructureForm } from "@/features/payroll/salary-structure-form";
import type { SalaryStructureRecord } from "@/types/payroll";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

export default function EditSalaryStructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [structure, setStructure] = useState<SalaryStructureRecord | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    salaryStructureService.get(id).then(setStructure).catch(() => setError(true));
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={() => window.location.reload()} />;
  if (!structure) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "HR & Payroll", href: "/hr" },
            { label: "Payroll", href: "/hr/payroll" },
            { label: "Salary Structures", href: "/hr/payroll/structures" },
            { label: structure.name },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {structure.name}</h1>
      </div>
      <SalaryStructureForm
        submitLabel="Save changes"
        defaultValues={{
          name: structure.name,
          description: structure.description,
          status: structure.status,
          items: structure.items.map((i) => ({
            componentId: i.componentId,
            componentName: i.component.name,
            componentType: i.component.componentType,
            calculationType: i.component.calculationType,
            amount: i.amount,
            percentage: i.percentage,
          })),
        }}
        onSubmit={async (input) => {
          await salaryStructureService.update(id, input);
          toast({ title: "Salary structure updated", variant: "success" });
          router.push(`/hr/payroll/structures/${id}`);
        }}
      />
    </div>
  );
}
