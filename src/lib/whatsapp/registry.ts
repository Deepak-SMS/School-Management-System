import { prisma } from "@/lib/db";
import { mockWhatsAppProvider, type MockWhatsAppProvider } from "@/lib/whatsapp/mock-provider";
import { baileysWhatsAppProvider } from "@/lib/whatsapp/baileys-provider";
import type { WhatsAppProvider } from "@/lib/whatsapp/provider";

const PROVIDERS: Record<string, WhatsAppProvider> = {
  mock: mockWhatsAppProvider,
  baileys: baileysWhatsAppProvider,
  // meta_cloud_api: metaCloudApiProvider,   // future — see WHATSAPP-ROADMAP.md
};

export class WhatsAppProviderNotFoundError extends Error {
  constructor(provider: string) {
    super(`Unknown WhatsApp provider "${provider}".`);
    this.name = "WhatsAppProviderNotFoundError";
  }
}

export function getWhatsAppProvider(providerId: string): WhatsAppProvider {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new WhatsAppProviderNotFoundError(providerId);
  return provider;
}

/** Resolves the provider for a school from WhatsAppAccount.provider, defaulting to the real "baileys" (WhatsApp Web) provider for a school that hasn't connected yet — "mock" only applies once a row explicitly opts into it. */
export async function getWhatsAppProviderForSchool(schoolId: string): Promise<WhatsAppProvider> {
  const account = await prisma.whatsAppAccount.findUnique({ where: { schoolId }, select: { provider: true } });
  return getWhatsAppProvider(account?.provider ?? "baileys");
}

/** Only meaningful when the resolved provider is the mock — narrows for the dev-only "Simulate Scan Now" action. */
export function asMockProvider(provider: WhatsAppProvider): MockWhatsAppProvider | null {
  return provider.id === "mock" ? (provider as unknown as MockWhatsAppProvider) : null;
}
