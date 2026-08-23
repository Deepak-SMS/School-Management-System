"use client";

import { PanelLeft } from "lucide-react";
import { useSidebar } from "@/providers/sidebar-provider";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/use-media-query";
import { TenantSwitcher } from "@/layouts/tenant-switcher";
import { GlobalSearch } from "@/layouts/global-search";
import { NotificationCenter } from "@/layouts/notification-center";
import { HelpMenu } from "@/layouts/help-menu";
import { AiAssistantTrigger } from "@/layouts/ai-assistant-trigger";
import { UserMenu } from "@/layouts/user-menu";

export function TopNav() {
  const { toggleCollapsed, setMobileOpen } = useSidebar();
  const isTabletUp = useMediaQuery(BREAKPOINTS.tablet);

  return (
    <header className="flex h-(--topnav-height) shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={() => (isTabletUp ? toggleCollapsed() : setMobileOpen(true))}
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/[.05] hover:text-foreground dark:hover:bg-white/[.06]"
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="size-4.5" aria-hidden="true" />
      </button>

      <TenantSwitcher />

      <div className="flex-1 px-2 sm:px-4">
        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <NotificationCenter />
        <div className="hidden sm:block">
          <HelpMenu />
        </div>
        <AiAssistantTrigger />
        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <UserMenu />
      </div>
    </header>
  );
}
