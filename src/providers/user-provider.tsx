"use client";

import { createContext, useContext } from "react";
import type { CurrentUser } from "@/types/user";

/**
 * Current-user context, seeded from the real session on the server (see
 * src/app/layout.tsx's `resolveCurrentUser()`) and passed down as
 * `initialUser`. There is no client-side identity switching anymore — signing
 * out and back in as someone else is what changes who this resolves to.
 */

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({
  initialUser,
  children,
}: {
  initialUser: CurrentUser | null;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={initialUser}>{children}</UserContext.Provider>;
}

/** Only valid inside a signed-in route (the (admin) layout redirects to /login otherwise). */
export function useCurrentUser(): CurrentUser {
  const user = useContext(UserContext);
  if (!user) {
    throw new Error("useCurrentUser() called outside a signed-in route — no user in context.");
  }
  return user;
}
