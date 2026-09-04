"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { EmptyState } from "@/components/ui/empty-state";
import { notificationService } from "@/services/notificationService";
import type { NotificationRecord } from "@/types/notification";
import { cn } from "@/lib/utils";

const LAST_VIEWED_KEY = "notifications.lastViewedAt";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);

  useEffect(() => {
    notificationService.list().then((r) => setNotifications(r.data)).catch(() => {});
    try {
      setLastViewedAt(localStorage.getItem(LAST_VIEWED_KEY));
    } catch {
      // localStorage unavailable (private browsing, etc.) — unread state just won't persist.
    }
  }, []);

  const unreadCount = lastViewedAt ? notifications.filter((n) => new Date(n.createdAt) > new Date(lastViewedAt)).length : notifications.length;

  function handleOpenChange(open: boolean) {
    if (open) return;
    const now = new Date().toISOString();
    setLastViewedAt(now);
    try {
      localStorage.setItem(LAST_VIEWED_KEY, now);
    } catch {
      // Same as above — best effort only.
    }
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/[.05] hover:text-foreground dark:hover:bg-white/[.06]"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="size-4.5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-danger-500" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
        </div>
        {notifications.length === 0 ? (
          <EmptyState title="You're all caught up" description="New notifications will show up here." />
        ) : (
          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {notifications.map((n) => {
              const isUnread = !lastViewedAt || new Date(n.createdAt) > new Date(lastViewedAt);
              const content = (
                <div className={cn("flex gap-3 px-4 py-3", isUnread && "bg-primary-50/50 dark:bg-primary-500/[.06]")}>
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", isUnread ? "bg-primary-600" : "bg-transparent")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.description && <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground/70">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                </div>
              );
              return n.relatedNewsId ? (
                <Link key={n.id} href={`/news/${n.relatedNewsId}`} className="block hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
