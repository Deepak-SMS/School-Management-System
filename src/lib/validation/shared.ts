import { z } from "zod";

/** Converts form-blank strings ("") to undefined right before hitting Prisma — matters most for relation fields like sectionId, where "" would fail as a foreign key. */
export function cleanEmptyStrings<T extends Record<string, unknown>>(input: T): T {
  const cleaned = { ...input };
  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === "") {
      (cleaned as Record<string, unknown>)[key] = undefined;
    }
  }
  return cleaned;
}

/**
 * Wraps a number schema so a blank/empty form field validates as "not provided" instead of
 * coercing to 0 and failing `.positive()`/comparison refinements — `z.coerce.number()` alone
 * turns "" into 0, which is a valid-looking number, not an absent one.
 */
export function optionalNumber<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), schema.optional());
}
