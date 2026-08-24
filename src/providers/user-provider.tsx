"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { CurrentUser, Role } from "@/types/user";
import { mockCurrentUser } from "@/lib/mock-data/user";

/**
 * Current-user context.
 *
 * There is no auth yet, so the identity is mocked. The role, however, is
 * switchable in development: `setRole` writes the `dev-role` cookie that
 * `getCurrentUser()` reads server-side (src/lib/current-user.ts), so the client
 * and the API agree on who is acting. That makes the permission matrix
 * demonstrable end-to-end before a login screen exists.
 *
 * When auth ships, drop the switcher and feed the session in here.
 */

const DEV_ROLE_COOKIE = "dev-role";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  school_admin: "School Admin",
  principal: "Principal",
  teacher: "Teacher",
  accountant: "Accountant",
  hr: "HR Admin",
  hr_staff: "HR Staff",
  hod: "Head of Department",
  librarian: "Librarian",
  transport_manager: "Transport Manager",
  hostel_manager: "Hostel Manager",
  parent: "Parent",
  student: "Student",
};

interface UserContextValue {
  user: CurrentUser;
  setRole: (role: Role) => void;
}

const UserContext = createContext<UserContextValue>({
  user: mockCurrentUser,
  setRole: () => {},
});

function readRoleCookie(): Role | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${DEV_ROLE_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return value && value in ROLE_LABELS ? (value as Role) : null;
}

/** The cookie never pushes changes — `setRole` reloads the page instead. */
function subscribeToRoleCookie() {
  return () => {};
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  // The cookie is an external store, so read it through useSyncExternalStore
  // rather than syncing it into state from an effect. The separate server
  // snapshot keeps SSR output stable (no cookie access during render).
  const role = useSyncExternalStore(
    subscribeToRoleCookie,
    () => readRoleCookie() ?? mockCurrentUser.role,
    () => mockCurrentUser.role,
  );

  const setRole = useCallback((next: Role) => {
    document.cookie = `${DEV_ROLE_COOKIE}=${next}; path=/; SameSite=Lax`;
    // Reload so server components and API calls re-resolve under the new role.
    window.location.reload();
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({
      user: { ...mockCurrentUser, role, roleLabel: ROLE_LABELS[role] },
      setRole,
    }),
    [role, setRole],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): CurrentUser {
  return useContext(UserContext).user;
}

/** Development-only helper backing the role switcher in the top nav. */
export function useRoleSwitcher() {
  const { user, setRole } = useContext(UserContext);
  return { role: user.role, setRole };
}
