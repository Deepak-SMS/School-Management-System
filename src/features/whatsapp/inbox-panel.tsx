"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Send, MessageCircle, Check, CheckCheck, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { whatsappChatService, type WhatsAppChatRecord, type WhatsAppChatMessageRecord } from "@/services/whatsappChatService";

const LIST_POLL_MS = 5000;
const THREAD_POLL_MS = 3000;

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString();
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Real WhatsApp-style receipt ticks — grey single (sent/pending), grey double (delivered), blue double (read). */
function StatusTick({ status }: { status: string | null }) {
  if (!status || status === "pending") return <Clock className="size-3" aria-label="Sending" />;
  if (status === "failed") return <span className="text-danger-200">!</span>;
  if (status === "sent") return <Check className="size-3.5" aria-label="Sent" />;
  if (status === "read") return <CheckCheck className="size-3.5 text-sky-300" aria-label="Read" />;
  return <CheckCheck className="size-3.5" aria-label="Delivered" />;
}

export function InboxPanel() {
  const [chats, setChats] = useState<WhatsAppChatRecord[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppChatMessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const loadChats = useCallback(async () => {
    try {
      const result = await whatsappChatService.list(q || undefined);
      setChats(result.data);
    } catch {
      // transient — next poll retries
    } finally {
      setLoadingChats(false);
    }
  }, [q]);

  useEffect(() => {
    setLoadingChats(true);
    const timeout = setTimeout(loadChats, 250);
    return () => clearTimeout(timeout);
  }, [loadChats]);

  useEffect(() => {
    const interval = setInterval(loadChats, LIST_POLL_MS);
    return () => clearInterval(interval);
  }, [loadChats]);

  const loadThread = useCallback(async () => {
    if (!selectedId) return;
    try {
      const result = await whatsappChatService.messages(selectedId);
      setMessages(result.messages);
    } catch {
      // transient
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    loadThread();
    whatsappChatService.markRead(selectedId).then(loadChats).catch(() => undefined);
    const interval = setInterval(loadThread, THREAD_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the selected chat changes, not on every loadChats/loadThread identity change
  }, [selectedId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function handleSend() {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    try {
      await whatsappChatService.send(selectedId, draft.trim());
      setDraft("");
      await loadThread();
      await loadChats();
    } catch (err) {
      toast({ title: "Couldn't send message", description: (err as { error?: string }).error, variant: "danger" });
    } finally {
      setSending(false);
    }
  }

  const selectedChat = chats.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="grid h-[70vh] grid-cols-[280px_1fr] overflow-hidden rounded-lg border border-border">
      <div className="flex flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <Input leadingIcon={<Search />} placeholder="Search chats…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <LoadingState label="Loading chats…" />
          ) : chats.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No conversations yet" description="Messages sent or received will show up here." className="py-10" />
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-background",
                  selectedId === c.id && "bg-primary-50",
                )}
              >
                <Avatar initials={initialsFor(c.name)} src={c.avatarUrl ?? undefined} alt={c.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeLabel(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {c.lastMessageFromMe && "You: "}
                      {c.lastMessagePreview}
                    </span>
                    {c.unreadCount > 0 && <Badge variant="primary">{c.unreadCount}</Badge>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col">
        {!selectedChat ? (
          <EmptyState icon={MessageCircle} title="Select a conversation" description="Choose a chat on the left to read and reply." className="m-auto" />
        ) : (
          <>
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <Avatar initials={initialsFor(selectedChat.name)} src={selectedChat.avatarUrl ?? undefined} alt={selectedChat.name} size="sm" />
              <div>
                <p className="text-sm font-medium text-foreground">{selectedChat.name}</p>
                <p className="text-xs text-muted-foreground">{selectedChat.phoneE164}</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto bg-background px-4 py-3">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                      m.direction === "out" ? "bg-primary-600 text-white" : "bg-surface-raised text-foreground",
                    )}
                  >
                    {m.text}
                    <div
                      className={cn(
                        "mt-1 flex items-center justify-end gap-1 text-[10px]",
                        m.direction === "out" ? "text-primary-100" : "text-muted-foreground",
                      )}
                    >
                      {new Date(m.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {m.direction === "out" && <StatusTick status={m.status} />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>
            <div className="flex items-end gap-2 border-t border-border p-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message…"
                rows={1}
                className="min-h-9 resize-none"
              />
              <Button onClick={handleSend} isLoading={sending} disabled={!draft.trim()}>
                <Send className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
