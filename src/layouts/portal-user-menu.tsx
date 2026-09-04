"use client";

import { LogOut, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { useCurrentUser } from "@/providers/user-provider";
import { useTheme } from "@/providers/theme-provider";

/**
 * Trimmed copy of src/layouts/user-menu.tsx for the portal shell — no
 * "My profile"/"Settings" links, since neither page exists under (portal)
 * yet, and this project's own convention is never to link to a page that
 * doesn't exist (see the comment on portalNavigation in config/navigation.ts).
 */
export function PortalUserMenu() {
  const user = useCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md p-1 pr-1.5 transition-colors hover:bg-black/[.05] dark:hover:bg-white/[.06]"
          aria-label="Account menu"
        >
          <Avatar initials={user.avatarInitials} size="sm" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="text-sm font-medium text-foreground">{user.name}</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
          <span className="mt-1 inline-flex w-fit rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700 dark:bg-primary-500/10">
            {user.roleLabel}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            toggleTheme();
          }}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger-600 data-[highlighted]:bg-danger-50 data-[highlighted]:text-danger-600"
          onSelect={() => void handleSignOut()}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
