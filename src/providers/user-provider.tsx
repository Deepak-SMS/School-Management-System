"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(mockCurrentUser.role);

  // Read after mount rather than during render: the cookie isn't available
  // during SSR, and reading it in render would desync server and client HTML.
  useEffect(() => {
    const stored = readRoleCookie();
    if (stored) setRoleState(stored);
  }, []);

  const setRole = useCallback((next: Role) => {
    document.cookie = `${DEV_ROLE_COOKIE}=${next}; path=/; SameSite=Lax`;
    setRoleState(next);
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
