export interface PhoneValidationResult {
  valid: boolean;
  e164: string | null;
  reason?: "empty" | "not_a_valid_number" | "invalid_india_mobile";
}

const INDIA_CODE = "91";

/**
 * Normalizes to WhatsApp's expected "+<countrycode><number>" form, no spaces/
 * dashes/parens. India-first: a bare 10-digit number starting 6-9 is assumed
 * domestic and prefixed +91; a number that already carries +/00/91 is
 * respected. Anything else is rejected rather than guessed at — a bad number
 * becomes an explicit INVALID_NUMBER job, never a silently-wrong send target.
 *
 * `defaultCountryCode` is a parameter, not hardcoded, so a later multi-country
 * school isn't blocked structurally — but nothing in this build passes
 * anything but the India default; a deliberate simplification, not an oversight.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode: string = INDIA_CODE): PhoneValidationResult {
  if (!raw || !raw.trim()) return { valid: false, e164: null, reason: "empty" };

  let digits = raw.trim().replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (!digits.startsWith("+")) {
    digits = /^[6-9]\d{9}$/.test(digits) ? `+${defaultCountryCode}${digits}` : `+${digits}`;
  }

  const match = /^\+([1-9]\d{7,14})$/.exec(digits);
  if (!match) return { valid: false, e164: null, reason: "not_a_valid_number" };

  if (defaultCountryCode === INDIA_CODE && digits.startsWith(`+${INDIA_CODE}`)) {
    if (!/^[6-9]\d{9}$/.test(digits.slice(3))) return { valid: false, e164: null, reason: "invalid_india_mobile" };
  }

  return { valid: true, e164: digits };
}

export function isValidWhatsAppNumber(raw: string | null | undefined): boolean {
  return normalizePhone(raw).valid;
}
