"use client";

import { useRouter } from "next/navigation";
import { feeStructureService } from "@/services/feeStructureService";
import { FeeStructureForm } from "@/features/fees/fee-structure-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewFeeStructurePage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Fees & Finance", href: "/fees/structure" },
            { label: "Fee Structure", href: "/fees/structure" },
            { label: "Add Fee Structure" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Fee Structure</h1>
      </div>
      <FeeStructureForm
        onSubmit={async (input) => {
          const created = await feeStructureService.create(input);
          toast({ title: "Fee structure created", variant: "success" });
          router.push(`/fees/structure/${created.id}`);
        }}
      />
    </div>
  );
}
