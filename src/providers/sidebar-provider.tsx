"use client";

import { createContext, useContext, useState } from "react";

interface SidebarContextValue {
  /** Desktop expanded/collapsed (icon-rail) state. */
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  /** Mobile/tablet drawer open state. */
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);
const STORAGE_KEY = "sms.sidebar-collapsed";

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === "true";
  // No saved preference yet: default to the compact icon-rail on tablet widths,
  // expanded on desktop. Mobile ignores this entirely (drawer nav instead).
  return window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);
  const [isMobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setIsCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleCollapsed, isMobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
