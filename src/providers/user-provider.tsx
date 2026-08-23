"use client";

import { createContext, useContext } from "react";
import type { CurrentUser } from "@/types/user";
import { mockCurrentUser } from "@/lib/mock-data/user";

const UserContext = createContext<CurrentUser>(mockCurrentUser);

export function UserProvider({ children }: { children: React.ReactNode }) {
  // Swap `mockCurrentUser` for the authenticated session once auth exists.
  return <UserContext.Provider value={mockCurrentUser}>{children}</UserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(UserContext);
}
