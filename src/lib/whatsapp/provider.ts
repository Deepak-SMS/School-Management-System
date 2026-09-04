/**
 * Everything the campaign engine and Connect screen need from a WhatsApp
 * backend. All methods are keyed by schoolId, not by an instance-held
 * connection — the provider itself is a stateless singleton; per-school
 * connection state lives in WhatsAppAccount (mock provider) or wherever a
 * real provider needs it (e.g. an in-memory socket map keyed by schoolId for
 * a Baileys provider) — invisible to every caller of this interface.
 *
 * Adding a real provider later: implement this interface, register it in
 * src/lib/whatsapp/registry.ts, let a school opt in via WhatsAppAccount.provider
 * — the worker and every route only ever call getWhatsAppProviderForSchool(),
 * never a specific provider directly, so this is a zero-touch swap.
 */

export interface WhatsAppConnectionStatus {
  status: "disconnected" | "connecting" | "connected" | "logged_out" | "expired";
  phoneNumber: string | null;
  displayName: string | null;
  connectedAt: Date | null;
}

export interface WhatsAppQrCode {
  /** data:image/png;base64,... */
  dataUrl: string;
  expiresAt: Date;
}

export interface WhatsAppAccountInfo {
  phoneNumber: string;
  displayName: string;
  businessName: string | null;
}

export interface WhatsAppSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  /** "mock" | "baileys" | "meta_cloud_api" */
  readonly id: string;
  /** Drives the "Simulation Mode" badge shown everywhere in the UI. */
  readonly isSimulated: boolean;

  connect(schoolId: string): Promise<WhatsAppQrCode>;
  disconnect(schoolId: string): Promise<void>;
  logout(schoolId: string): Promise<void>;
  getConnectionStatus(schoolId: string): Promise<WhatsAppConnectionStatus>;
  getQRCode(schoolId: string): Promise<WhatsAppQrCode | null>;
  getAccountInfo(schoolId: string): Promise<WhatsAppAccountInfo | null>;
  sendTextMessage(schoolId: string, to: string, text: string): Promise<WhatsAppSendResult>;
}

export class WhatsAppNotConnectedError extends Error {
  constructor() {
    super("This school's WhatsApp isn't connected yet. Connect it from the WhatsApp Dashboard first.");
    this.name = "WhatsAppNotConnectedError";
  }
}
