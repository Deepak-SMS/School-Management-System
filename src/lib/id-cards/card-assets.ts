import { readStoredFile } from "@/lib/storage";

/**
 * Shared helpers for turning stored references into the bytes and URLs the PDF
 * renderer needs.
 *
 * These were duplicated in the generate and regenerate routes; the single-card
 * PDF download is a third consumer, so they live here instead.
 */

/** The public URL a `qrcode` element encodes — scanning it opens the verification page. */
export function verificationUrl(origin: string, code: string): string {
  return `${origin}/verify/${code}`;
}

/**
 * Local file URLs look like `/api/files/{uploadedFileId}`. Resolves one straight
 * to bytes, or null for anything else (an external URL, or unset).
 */
export async function readBytesFromStoredUrl(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  const match = url.match(/\/api\/files\/([^/?]+)/);
  if (!match) return null;
  const stored = await readStoredFile(match[1]);
  return stored?.data ?? null;
}
