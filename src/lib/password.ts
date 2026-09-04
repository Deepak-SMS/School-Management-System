import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Password hashing via Node's built-in scrypt — no native dependency to
 * compile (bcrypt/argon2 both require one), which matters on top of
 * better-sqlite3 already being a native module in this stack.
 */

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  if (candidate.length !== hashBuffer.length) return false;
  return timingSafeEqual(candidate, hashBuffer);
}

/** Generates a temporary password to hand to a newly created login. */
export function generateTemporaryPassword(): string {
  return randomBytes(9).toString("base64url");
}
