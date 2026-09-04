"use client";

import { useMemo, useState } from "react";
import { Plus, Search, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/loading-state";
import { cn } from "@/lib/utils";
import type { AiConversationSummary } from "@/types/ai";

interface ChatSidebarProps {
  conversations: AiConversationSummary[] | null;
  error?: boolean;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ChatSidebar({ conversations, error, onRetry, selectedId, onSelect, onNew, onDelete }: ChatSidebarProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!conversations) return null;
    if (!query.trim()) return conversations;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border">
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <Button onClick={onNew} className="w-full justify-start gap-2">
          <Plus className="size-4" /> New conversation
        </Button>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
          leadingIcon={<Search className="size-3.5" />}
          className="h-8 text-xs"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {error ? (
          <ErrorState
            title="Couldn't load conversations"
            description="Check your connection and try again."
            onRetry={onRetry}
            className="py-10"
          />
        ) : !filtered ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={query ? "No matches" : "No conversations yet"}
            description={query ? "Try a different search." : "Start a new conversation to see it here."}
            className="py-10"
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    conversation.id === selectedId
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-500/10"
                      : "text-foreground hover:bg-black/[.04] dark:hover:bg-white/[.04]",
                  )}
                >
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{conversation.title}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Delete conversation"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conversation.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        onDelete(conversation.id);
                      }
                    }}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:text-danger-600 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
