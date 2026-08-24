"use client";

import { useCallback } from "react";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

/**
 * Client-side permission check, reading the same matrix the server enforces.
 *
 * This is for hiding controls the user cannot use — it is a UX affordance, never
 * the security boundary. Every action it gates is independently checked by
 * `requirePermission()` in the route handler.
 */
export function useCan() {
  const user = useCurrentUser();

  return useCallback(
    (module: PermissionModule, action: PermissionAction) => hasPermission(user.role, module, action),
    [user.role],
  );
}
