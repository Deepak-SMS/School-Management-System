import { gmailProvider } from "@/lib/email-campaigns/gmail-provider";
import type { EmailProvider } from "@/lib/email-campaigns/provider";

/**
 * Only Gmail today. Adding SMTP/SendGrid/SES/Microsoft Graph later (per
 * EMAIL-ROADMAP.md) is: implement EmailProvider, register it here, let a
 * school opt in — zero changes to campaigns, templates, or the worker.
 */
const PROVIDERS: Record<string, EmailProvider> = {
  gmail: gmailProvider,
};

export function getEmailProvider(id: string = "gmail"): EmailProvider {
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Unknown email provider "${id}".`);
  return provider;
}
