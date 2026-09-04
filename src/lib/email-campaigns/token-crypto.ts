import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * AES-256-GCM encryption for Gmail OAuth tokens at rest. No encryption
 * utility existed anywhere in this codebase before this module — password
 * handling (src/lib/password.ts) is one-way hashing via scrypt, deliberately
 * not reversible, which is the wrong primitive for something we must later
 * decrypt to make a Gmail API call. Node's built-in crypto only, matching
 * this project's established "no native dependency to compile" preference.
 *
 * Required: TOKEN_ENCRYPTION_KEY (any secret string, at least 16 chars — it's
 * stretched into a real 256-bit key via scrypt with a fixed application-level
 * salt, since it's an env secret, not a user password needing a unique salt).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT = "school-erp-token-encryption-v1";

export class TokenEncryptionNotConfiguredError extends Error {
  constructor() {
    super("TOKEN_ENCRYPTION_KEY is not set. Add it to the environment before connecting Gmail.");
    this.name = "TokenEncryptionNotConfiguredError";
  }
}

let cachedKey: Buffer | null = null;

function key(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new TokenEncryptionNotConfiguredError();
  if (!cachedKey) cachedKey = scryptSync(secret, SALT, 32);
  return cachedKey;
}

/** Returns `iv:authTag:ciphertext`, all base64 — a plain string so it fits a normal String column. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptToken(encoded: string): string {
  const [ivB64, authTagB64, dataB64] = encoded.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) throw new Error("Malformed encrypted token.");
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
