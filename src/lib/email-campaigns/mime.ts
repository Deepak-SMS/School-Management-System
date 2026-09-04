export interface MimeMessageInput {
  to: string;
  fromEmail: string;
  fromName?: string;
  subject: string;
  html: string;
  text: string;
}

/** RFC 2047 encoded-word — safe for any subject, ASCII or not (₹, Hindi/Marathi names, etc). */
function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

/**
 * Builds a multipart/alternative RFC 2822 message and returns it
 * base64url-encoded, ready for Gmail API's messages.send `raw` field. No
 * attachments in this build — see src/lib/email-campaigns/attachment-resolver.ts
 * for that seam.
 */
export function buildRawMimeMessage(input: MimeMessageInput): string {
  const boundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const from = input.fromName ? `"${input.fromName.replace(/"/g, "")}" <${input.fromEmail}>` : input.fromEmail;

  const lines = [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
  ];

  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}
