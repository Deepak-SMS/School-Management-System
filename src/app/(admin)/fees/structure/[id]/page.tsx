"use client";

import { use } from "react";
import { FeeStructureDetail } from "@/features/fees/fee-structure-detail";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function FeeStructureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <Breadcrumb
        items={[
          { label: "Fees & Finance", href: "/fees/structure" },
          { label: "Fee Structure", href: "/fees/structure" },
          { label: "Details" },
        ]}
      />
      <FeeStructureDetail id={id} />
    </div>
  );
}
