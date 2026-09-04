/** Lowercase, hyphenated, URL-safe form of a string — e.g. "ABC School" -> "abc-school". */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Top-level URL segments already owned by app routes (see src/app/*).
 * A school slug matching one of these would either shadow a real route or
 * never resolve to the branded /{slug}/admin login page, so it's excluded
 * from slug generation up front.
 */
export const RESERVED_SLUGS = new Set([
  "api",
  "login",
  "register",
  "verify",
  "verify-certificate",
  "super-admin",
  "academics",
  "admin",
  "admissions",
  "ai",
  "certificates",
  "employees",
  "exams",
  "fees",
  "finance",
  "hr",
  "id-cards",
  "library",
  "news",
  "school",
  "students",
  "transport",
]);

/** True if `segment` is one of this app's own top-level routes, never a school slug. */
export function isReservedSlug(segment: string): boolean {
  return RESERVED_SLUGS.has(segment);
}

/**
 * Generates a slug for a school from its short name (or name), appending
 * -2, -3, ... on collision with an existing slug or a reserved route segment.
 * `exists` is injected so callers can check inside or outside a transaction.
 */
export async function generateUniqueSchoolSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "school";
  let candidate = root;
  let suffix = 2;
  while (RESERVED_SLUGS.has(candidate) || (await exists(candidate))) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
