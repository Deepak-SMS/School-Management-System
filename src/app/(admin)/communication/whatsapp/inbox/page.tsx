import { Breadcrumb } from "@/components/ui/breadcrumb";
import { InboxPanel } from "@/features/whatsapp/inbox-panel";

export default function WhatsAppInboxPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <Breadcrumb items={[{ label: "Communication", href: "/communication/whatsapp" }, { label: "WhatsApp", href: "/communication/whatsapp" }, { label: "Inbox" }]} />
      <div>
        <h1 className="text-xl font-semibold text-foreground">WhatsApp Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real conversations on the connected WhatsApp number — replies and messages sent directly from the phone both show up here.</p>
      </div>
      <InboxPanel />
    </div>
  );
}
