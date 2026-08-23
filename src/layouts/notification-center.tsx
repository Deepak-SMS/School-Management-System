"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { mockNotifications } from "@/lib/mock-data/notifications";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Popover>
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
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))}
            >
              Mark all as read
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <EmptyState title="You're all caught up" description="New notifications will show up here." />
        ) : (
          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className={cn("flex gap-3 px-4 py-3", !n.isRead && "bg-primary-50/50 dark:bg-primary-500/[.06]")}>
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-primary-600")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">{n.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
