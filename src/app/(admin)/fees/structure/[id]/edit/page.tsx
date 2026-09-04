"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { feeStructureService } from "@/services/feeStructureService";
import { FeeStructureForm } from "@/features/fees/fee-structure-form";
import type { FeeStructureInput } from "@/lib/validation/fee-structure";
import type { FeeStructureRecord } from "@/types/fees";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

function toDefaultValues(structure: FeeStructureRecord): Partial<FeeStructureInput> {
  return {
    name: structure.name,
    description: structure.description ?? undefined,
    academicYearId: structure.academicYearId,
    classId: structure.classId ?? undefined,
    sectionId: structure.sectionId ?? undefined,
    studentCategoryId: structure.studentCategoryId ?? undefined,
    items: structure.items.map((item) => ({
      feeCategoryId: item.feeCategoryId,
      amount: item.amount,
      frequency: item.frequency as FeeStructureInput["items"][number]["frequency"],
      isOptional: item.isOptional,
      lateFeeRuleId: item.lateFeeRuleId ?? undefined,
      installments: item.installments.map((installment) => ({
        label: installment.label,
        dueDate: installment.dueDate.slice(0, 10),
        amount: installment.amount,
      })),
    })),
  };
}

export default function EditFeeStructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [structure, setStructure] = useState<FeeStructureRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    feeStructureService
      .get(id)
      .then((s) => {
        setStructure(s);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!structure) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Fees & Finance", href: "/fees/structure" },
            { label: "Fee Structure", href: "/fees/structure" },
            { label: structure.name, href: `/fees/structure/${id}` },
            { label: "Edit" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {structure.name}</h1>
      </div>
      <FeeStructureForm
        defaultValues={toDefaultValues(structure)}
        submitLabel="Save changes"
        locked={structure.status !== "draft"}
        onSubmit={async (input) => {
          await feeStructureService.update(id, input);
          toast({ title: "Fee structure updated", variant: "success" });
          router.push(`/fees/structure/${id}`);
        }}
      />
    </div>
  );
}
