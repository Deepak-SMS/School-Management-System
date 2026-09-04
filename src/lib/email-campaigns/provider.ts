/**
 * Everything the campaign engine needs from an email backend — the campaign
 * system never imports GmailProvider directly, only this interface (via
 * src/lib/email-campaigns/registry.ts), so SMTP/SendGrid/SES/Microsoft Graph
 * can be added later with zero changes to campaigns/templates/the worker.
 */

export type EmailErrorType = "RETRYABLE" | "NON_RETRYABLE" | "AUTH_ERROR" | "RATE_LIMIT" | "INVALID_RECIPIENT" | "NETWORK_ERROR" | "PROVIDER_ERROR";

export interface EmailConnectionStatus {
  connected: boolean;
  email: string | null;
  status: "connected" | "disconnected" | "reauth_required" | "error";
  lastError: string | null;
}

export interface EmailSendInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  errorType?: EmailErrorType;
}

export interface EmailProvider {
  readonly id: string;
  getConnectionStatus(schoolId: string): Promise<EmailConnectionStatus>;
  /** A cheap real API call (e.g. fetching the account profile) to confirm the connection still works — used by "Test Connection" and before starting a campaign. */
  validateConnection(schoolId: string): Promise<{ ok: boolean; error?: string }>;
  sendEmail(schoolId: string, input: EmailSendInput): Promise<EmailSendResult>;
  disconnect(schoolId: string): Promise<void>;
}

export class EmailNotConnectedError extends Error {
  constructor() {
    super("This school's Gmail isn't connected yet. Connect it from Communication → Email → Settings first.");
    this.name = "EmailNotConnectedError";
  }
}
