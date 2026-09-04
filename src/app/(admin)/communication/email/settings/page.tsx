import { Breadcrumb } from "@/components/ui/breadcrumb";
import { GmailConnectPanel } from "@/features/email/gmail-connect-panel";

export default function EmailSettingsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <Breadcrumb items={[{ label: "Communication", href: "/communication/email" }, { label: "Email", href: "/communication/email" }, { label: "Settings" }]} />
      <div>
        <h1 className="text-xl font-semibold text-foreground">Gmail Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect the Gmail account campaigns will send from.</p>
      </div>
      <GmailConnectPanel />
    </div>
  );
}
