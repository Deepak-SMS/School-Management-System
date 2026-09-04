"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Square, RotateCcw, Download, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { aiService } from "@/services/aiService";
import { MessageBubble } from "@/features/ai/assistant/message-bubble";
import { OllamaStatusBadge } from "@/features/ai/assistant/ollama-status-badge";
import { SUGGESTED_QUESTIONS } from "@/lib/ai/prompts/school-assistant";
import type { AiMessageRecord } from "@/types/ai";

interface DisplayMessage extends AiMessageRecord {
  streaming?: boolean;
}

interface ChatWindowProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onConversationChanged: () => void;
  onConversationDeleted: (id: string) => void;
}

function tempId() {
  return `local-${crypto.randomUUID()}`;
}

export function ChatWindow({ conversationId, onConversationCreated, onConversationChanged, onConversationDeleted }: ChatWindowProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Set right before onConversationCreated() so the effect below doesn't re-fetch and clobber the reply that's still streaming in. */
  const createdLocallyRef = useRef<string | null>(null);

  function loadConversation(id: string) {
    setLoading(true);
    setLoadError(false);
    aiService
      .getConversation(id)
      .then((conversation) => setMessages(conversation.messages))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // Null (new chat) and a self-created id both need no fetch — the empty
    // state is this instance's initial state, and switching to a genuinely
    // different conversation is handled by remounting (see the `key` this
    // component is given in AiAssistantPage), not by resetting state here.
    if (!conversationId) return;
    if (createdLocallyRef.current === conversationId) {
      createdLocallyRef.current = null;
      return;
    }
    loadConversation(conversationId);
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Abort any in-flight stream if this instance is torn down (e.g. the user
  // navigates to a different conversation, which remounts this component).
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function runStream(body: { conversationId?: string; message?: string; regenerate?: boolean }, assistantId: string) {
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    aiService
      .streamChat(
        body,
        {
          onStart: (newId) => {
            if (!conversationId) {
              createdLocallyRef.current = newId;
              onConversationCreated(newId);
            }
          },
          onChunk: (content) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + content } : m)));
          },
          onError: (message) => {
            toast({ title: "AI Assistant", description: message, variant: "danger" });
            setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.content));
          },
          onDone: () => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
            onConversationChanged();
          },
        },
        controller.signal,
      )
      .catch(() => {
        // Aborted by the user (Stop) — the reply so far stays, just marked as no longer streaming.
      })
      .finally(() => {
        setIsStreaming(false);
        abortRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
      });
  }

  function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;
    setInput("");

    const userMessage: DisplayMessage = { id: tempId(), role: "user", content, createdAt: new Date().toISOString() };
    const assistantId = tempId();
    const assistantMessage: DisplayMessage = { id: assistantId, role: "assistant", content: "", createdAt: new Date().toISOString(), streaming: true };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    runStream({ conversationId: conversationId ?? undefined, message: content }, assistantId);
  }

  function handleRegenerate() {
    if (!conversationId || isStreaming) return;
    const lastUserIndex = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIndex === -1) return;
    const cutIndex = messages.length - 1 - lastUserIndex;
    const assistantId = tempId();
    setMessages((prev) => [...prev.slice(0, cutIndex + 1), { id: assistantId, role: "assistant", content: "", createdAt: new Date().toISOString(), streaming: true }]);
    runStream({ conversationId, regenerate: true }, assistantId);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleExport() {
    const text = messages
      .map((m) => `## ${m.role === "user" ? "You" : "AI School Assistant"}\n\n${m.content}`)
      .join("\n\n---\n\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai-conversation.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleClearConfirmed() {
    setConfirmClear(false);
    if (conversationId) {
      await aiService.deleteConversation(conversationId).catch(() => undefined);
      onConversationDeleted(conversationId);
    }
    setMessages([]);
  }

  const canRegenerate = !isStreaming && conversationId && messages.some((m) => m.role === "user");

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary-600" />
          <h2 className="text-sm font-semibold text-foreground">AI School Assistant</h2>
        </div>
        <div className="flex items-center gap-2">
          <OllamaStatusBadge />
          {messages.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={handleExport} title="Export conversation">
                <Download className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} title="Clear conversation">
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <LoadingState label="Loading conversation…" />
        ) : loadError ? (
          <ErrorState onRetry={() => conversationId && loadConversation(conversationId)} />
        ) : messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/10">
              <Sparkles className="size-6 text-primary-600" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Ask the AI School Assistant anything</p>
              <p className="mt-1 text-sm text-muted-foreground">
                It only answers from this conversation right now — real school data arrives as ERP tools are wired in.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="rounded-full border border-border-strong px-3 py-1.5 text-xs text-foreground hover:bg-background"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} streaming={m.streaming} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          {canRegenerate && (
            <Button variant="outline" size="sm" onClick={handleRegenerate} className="shrink-0 gap-1.5">
              <RotateCcw className="size-3.5" /> Regenerate
            </Button>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message the AI School Assistant…"
            className="min-h-10 flex-1 resize-none"
            rows={1}
          />
          {isStreaming ? (
            <Button variant="secondary" size="icon" onClick={handleStop} title="Stop generation">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={() => handleSend()} disabled={!input.trim()} title="Send">
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear this conversation?"
        description="This deletes the conversation and its messages. This can't be undone."
        confirmLabel="Clear"
        variant="destructive"
        onConfirm={handleClearConfirmed}
      />
    </div>
  );
}
