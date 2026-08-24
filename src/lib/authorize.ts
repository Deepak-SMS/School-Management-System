import { hasPermission, canViewSensitivePay } from "@/config/permissions";
import { permissionKey, type PermissionAction, type PermissionModule } from "@/types/permissions";
import { getCurrentUser, type RequestUser } from "@/lib/current-user";

/**
 * Server-side authorization for HR routes.
 *
 * Every mutating HR endpoint calls `requirePermission()` before touching Prisma.
 * Frontend gating (hidden buttons, filtered nav) is a convenience only — this is
 * the actual control, per spec §40 "never rely only on frontend hiding".
 */

export class ForbiddenError extends Error {
  readonly permission: string;

  constructor(module: PermissionModule, action: PermissionAction) {
    super("You do not have permission to perform this action.");
    this.name = "ForbiddenError";
    this.permission = permissionKey(module, action);
  }
}

/**
 * Resolves the acting user and asserts they hold `module:action`.
 * Returns the user so callers can attribute audit entries without a second lookup.
 */
export async function requirePermission(
  module: PermissionModule,
  action: PermissionAction,
): Promise<RequestUser> {
  const user = await getCurrentUser();
  if (!hasPermission(user.role, module, action)) {
    throw new ForbiddenError(module, action);
  }
  return user;
}

/** Non-throwing variant, for deciding whether to include optional data in a response. */
export async function currentUserCan(module: PermissionModule, action: PermissionAction): Promise<boolean> {
  const user = await getCurrentUser();
  return hasPermission(user.role, module, action);
}

/** Salary/bank/PAN keys stripped from Staff payloads for callers without `employeeSalary:view`. */
const SENSITIVE_STAFF_FIELDS = [
  "panNumber",
  "bankName",
  "bankAccountNumber",
  "bankIfsc",
  "bankAccountHolder",
  "pfNumber",
  "esicNumber",
] as const;

/**
 * Removes sensitive pay fields unless the role may see them. Applied in the route
 * so the data never leaves the server, rather than being hidden in the UI.
 */
export function redactSensitivePay<T extends Record<string, unknown>>(record: T, user: RequestUser): T {
  if (canViewSensitivePay(user.role)) return record;
  const safe = { ...record };
  for (const field of SENSITIVE_STAFF_FIELDS) {
    if (field in safe) delete (safe as Record<string, unknown>)[field];
  }
  return safe;
}

export function redactSensitivePayList<T extends Record<string, unknown>>(records: T[], user: RequestUser): T[] {
  if (canViewSensitivePay(user.role)) return records;
  return records.map((r) => redactSensitivePay(r, user));
}
