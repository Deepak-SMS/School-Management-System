"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PanelLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { PlatformUser } from "@/lib/platform-auth";

export function PlatformTopNav({ user, onOpenMobileNav }: { user: PlatformUser; onOpenMobileNav: () => void }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/super-admin/login");
    router.refresh();
  }

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-(--topnav-height) shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/[.05] hover:text-foreground dark:hover:bg-white/[.06] md:hidden"
        aria-label="Open navigation"
      >
        <PanelLeft className="size-4.5" aria-hidden="true" />
      </button>

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <Avatar initials={initials} size="sm" />
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} isLoading={isLoggingOut}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </header>
  );
}
