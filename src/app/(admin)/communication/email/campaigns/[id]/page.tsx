"use client";

import { use } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CampaignDetail } from "@/features/email/campaign-detail";

export default function EmailCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <Breadcrumb
        items={[
          { label: "Communication", href: "/communication/email" },
          { label: "Email", href: "/communication/email" },
          { label: "Campaigns", href: "/communication/email/campaigns" },
          { label: "Details" },
        ]}
      />
      <CampaignDetail id={id} />
    </div>
  );
}
