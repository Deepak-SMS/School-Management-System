import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound email.
 *
 * Configuration lives entirely in the environment, so a school that hasn't set
 * up SMTP yet gets a clear, honest refusal rather than a button that silently
 * does nothing. `isMailConfigured()` is what the UI asks before offering to
 * send, and the route checks it again before trying.
 *
 * Required: MAIL_HOST, MAIL_PORT, MAIL_FROM.
 * Optional: MAIL_USER + MAIL_PASSWORD (omit for an unauthenticated relay),
 *           MAIL_SECURE=true to force TLS on connect (port 465).
 */

export class MailNotConfiguredError extends Error {
  constructor() {
    super(
      "Email hasn't been set up for this school yet. Add MAIL_HOST, MAIL_PORT and MAIL_FROM to the environment to enable sending.",
    );
    this.name = "MailNotConfiguredError";
  }
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.MAIL_HOST && process.env.MAIL_PORT && process.env.MAIL_FROM);
}

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (!isMailConfigured()) throw new MailNotConfiguredError();
  if (cached) return cached;

  const port = Number(process.env.MAIL_PORT);
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;

  cached = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    // 465 is implicit TLS; everything else negotiates with STARTTLS.
    secure: process.env.MAIL_SECURE === "true" || port === 465,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });

  return cached;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
  /** Shown as the sender name; the address always comes from MAIL_FROM. */
  fromName?: string;
}

export async function sendMail(params: SendMailParams): Promise<{ messageId: string }> {
  const from = params.fromName
    ? `"${params.fromName.replace(/"/g, "")}" <${process.env.MAIL_FROM}>`
    : process.env.MAIL_FROM;

  const info = await transporter().sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments,
  });

  return { messageId: info.messageId };
}
