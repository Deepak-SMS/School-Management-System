"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PortalChild } from "@/types/portal";
import { portalService } from "@/services/portalService";
import { useCurrentUser } from "@/providers/user-provider";

interface ActiveChildContextValue {
  children: PortalChild[];
  activeChild: PortalChild | undefined;
  setActiveChildId: (id: string) => void;
  isLoading: boolean;
}

const ActiveChildContext = createContext<ActiveChildContextValue | null>(null);
const STORAGE_KEY = "sms.portal-active-child";

/**
 * The parent/student portal's equivalent of TenantProvider — "which child am
 * I currently looking at" instead of "which school/campus/year." For a
 * student login, `children` is always exactly `[self]` and switching never
 * applies (the API already refuses to return anyone else).
 */
export function ActiveChildProvider({ children: reactChildren }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const [portalChildren, setPortalChildren] = useState<PortalChild[]>([]);
  const [activeChildId, setActiveChildIdState] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    portalService
      .listChildren()
      .then(({ data }) => {
        if (cancelled) return;
        setPortalChildren(data);
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const chosen = data.find((c) => c.id === stored) ?? data[0];
        if (chosen) setActiveChildIdState(chosen.id);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    if (!activeChildId) return;
    window.localStorage.setItem(STORAGE_KEY, activeChildId);
  }, [activeChildId]);

  const activeChild = useMemo(
    () => portalChildren.find((c) => c.id === activeChildId),
    [portalChildren, activeChildId],
  );

  return (
    <ActiveChildContext.Provider
      value={{ children: portalChildren, activeChild, setActiveChildId: setActiveChildIdState, isLoading }}
    >
      {reactChildren}
    </ActiveChildContext.Provider>
  );
}

export function useActiveChild() {
  const ctx = useContext(ActiveChildContext);
  if (!ctx) throw new Error("useActiveChild must be used within ActiveChildProvider");
  return ctx;
}
