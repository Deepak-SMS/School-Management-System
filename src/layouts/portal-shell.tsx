"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { getNavigationForRole } from "@/config/navigation";
import { useCurrentUser } from "@/providers/user-provider";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/use-media-query";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { NotificationCenter } from "@/layouts/notification-center";
import { PortalUserMenu } from "@/layouts/portal-user-menu";
import { ChildSwitcher } from "@/layouts/child-switcher";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/navigation";

/** How many destinations fit as primary bottom tabs before the rest move into the "More" drawer. */
const PRIMARY_TAB_COUNT = 4;

/**
 * The parent/student portal shell — deliberately lighter than AppShell
 * (src/layouts/app-shell.tsx): no icon-collapsible sidebar or tenant
 * switcher, since a portal login never switches school/campus/year. Desktop
 * gets a slim inline nav row; mobile gets a bottom tab bar, since that's
 * where this shell is mostly used (PARENT-STUDENT-PORTAL-ROADMAP.md §"mobile
 * responsiveness").
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const pathname = usePathname();
  const isDesktop = useMediaQuery(BREAKPOINTS.tablet);
  const [moreOpen, setMoreOpen] = useState(false);

  const items: NavItem[] = getNavigationForRole(user.role).flatMap((section) => section.items);
  const primary = items.slice(0, PRIMARY_TAB_COUNT);
  const overflow = items.slice(PRIMARY_TAB_COUNT);

  function isActive(href: string) {
    return href === "/portal" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <span className="font-semibold text-foreground">Classlane</span>
        {user.role === "parent" && <ChildSwitcher />}
        <div className="ml-auto flex items-center gap-1">
          <NotificationCenter />
          <PortalUserMenu />
        </div>
      </header>

      {isDesktop && (
        <nav className="flex items-center gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-1.5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-500/10"
                  : "text-muted-foreground hover:bg-black/[.03] hover:text-foreground dark:hover:bg-white/[.04]",
              )}
            >
              {item.icon && <item.icon className="size-4" />}
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      <main className="flex-1 overflow-y-auto pb-20 md:pb-6">{children}</main>

      {!isDesktop && (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
          {primary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium",
                isActive(item.href) ? "text-primary-700 dark:text-primary-400" : "text-muted-foreground",
              )}
            >
              {item.icon && <item.icon className="size-5" />}
              {item.label}
            </Link>
          ))}
          {overflow.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-muted-foreground"
            >
              <Menu className="size-5" />
              More
            </button>
          )}
        </nav>
      )}

      {overflow.length > 0 && (
        <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
          <DrawerContent side="right" title="More" hideTitle={false} widthClassName="w-64">
            <nav className="flex flex-col gap-1 p-3 pt-10">
              {overflow.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
                    isActive(item.href)
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-500/10"
                      : "text-foreground hover:bg-black/[.03] dark:hover:bg-white/[.04]",
                  )}
                >
                  {item.icon && <item.icon className="size-4" />}
                  {item.label}
                </Link>
              ))}
            </nav>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
