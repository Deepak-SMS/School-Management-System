import { prisma } from "@/lib/db";
import { sendMail, isMailConfigured } from "@/lib/mail";
import type { ResolvedRecipient } from "@/lib/ai/communication/audience";

export interface SendCommunicationInput {
  schoolId: string;
  subject: string;
  body: string;
  /** Empty for a "custom"/no-real-audience draft — sending then only posts the in-app notification. */
  recipients: ResolvedRecipient[];
}

export interface SendCommunicationResult {
  inAppSent: boolean;
  emailsSent: number;
  emailsSkipped: number;
  emailConfigured: boolean;
}

/**
 * The one real dispatch path for AI-drafted communications (spec §9: sending
 * must be an explicit, confirmed action — this function is only ever called
 * after the caller's own confirmation step, never automatically).
 *
 * Always posts an in-app Notification (works with zero configuration — the
 * existing school-wide feed used by News). Additionally emails every resolved
 * recipient with an address on file, but only if MAIL_HOST/MAIL_PORT/MAIL_FROM
 * are configured — otherwise this reports that honestly rather than pretending
 * to have sent something it didn't.
 */
export async function sendCommunication(input: SendCommunicationInput): Promise<SendCommunicationResult> {
  await prisma.notification.create({
    data: { schoolId: input.schoolId, type: "ai_communication", title: input.subject || "School communication", description: input.body },
  });

  const emailConfigured = isMailConfigured();
  let emailsSent = 0;
  let emailsSkipped = 0;

  if (emailConfigured) {
    for (const recipient of input.recipients) {
      if (!recipient.email) {
        emailsSkipped += 1;
        continue;
      }
      try {
        await sendMail({ to: recipient.email, subject: input.subject || "School communication", text: input.body });
        emailsSent += 1;
      } catch {
        emailsSkipped += 1;
      }
    }
  } else {
    emailsSkipped = input.recipients.length;
  }

  return { inAppSent: true, emailsSent, emailsSkipped, emailConfigured };
}
