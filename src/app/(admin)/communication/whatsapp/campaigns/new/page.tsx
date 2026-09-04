import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CampaignWizard } from "@/features/whatsapp/campaign-wizard";

export default function NewWhatsAppCampaignPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <Breadcrumb
        items={[
          { label: "Communication", href: "/communication/whatsapp" },
          { label: "WhatsApp", href: "/communication/whatsapp" },
          { label: "Campaigns", href: "/communication/whatsapp/campaigns" },
          { label: "New Campaign" },
        ]}
      />
      <div>
        <h1 className="text-xl font-semibold text-foreground">Create Campaign</h1>
        <p className="mt-1 text-sm text-muted-foreground">Build a personalized WhatsApp bulk send in a few steps.</p>
      </div>
      <CampaignWizard />
    </div>
  );
}
