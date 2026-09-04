import { ForbiddenError } from "@/lib/authorize";
import type { RequestUser } from "@/lib/current-user";
import type { EmailRecipientType } from "@/lib/email-campaigns/recipient-types";

/**
 * Row-level restriction on top of the coarse `emailCampaigns` grant — same
 * pattern src/lib/whatsapp/campaign-scope.ts already applies. Only
 * `accountant` needs one: `teacher` holds no `emailCampaigns` grant at all
 * (view-only on templates, per spec), so there's nothing to scope for them.
 */
export function assertRecipientTypeAllowedForUser(user: RequestUser, recipientType: EmailRecipientType): void {
  if (user.role === "accountant" && recipientType !== "fee_defaulters") {
    throw new ForbiddenError("emailCampaigns", "create");
  }
}
