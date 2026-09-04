"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";

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

function readStoredCollapsed(): boolean {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === "true";
  // No saved preference yet: default to the compact icon-rail on tablet widths,
  // expanded on desktop. Mobile ignores this entirely (drawer nav instead).
  return window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches;
}

/**
 * Tiny external store over localStorage. Reading it through
 * useSyncExternalStore (server snapshot always "expanded") instead of
 * useState+useEffect means the SSR pass and first client render agree, rather
 * than hydrating one value and flipping it a tick later — the same approach
 * the old dev-role cookie reader used in user-provider.tsx.
 */
const listeners = new Set<() => void>();
let cachedCollapsed: boolean | null = null;

function getCollapsedSnapshot(): boolean {
  if (cachedCollapsed === null) cachedCollapsed = readStoredCollapsed();
  return cachedCollapsed;
}

function getServerCollapsedSnapshot(): boolean {
  return false;
}

function subscribeToCollapsed(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function setCollapsed(next: boolean) {
  cachedCollapsed = next;
  window.localStorage.setItem(STORAGE_KEY, String(next));
  listeners.forEach((listener) => listener());
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isCollapsed = useSyncExternalStore(subscribeToCollapsed, getCollapsedSnapshot, getServerCollapsedSnapshot);
  const [isMobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed(!getCollapsedSnapshot());
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
