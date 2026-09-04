"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatSidebar } from "@/features/ai/assistant/chat-sidebar";
import { ChatWindow } from "@/features/ai/assistant/chat-window";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { aiService } from "@/services/aiService";
import type { AiConversationSummary } from "@/types/ai";

export default function AiAssistantPage() {
  const [conversations, setConversations] = useState<AiConversationSummary[] | null>(null);
  const [conversationsError, setConversationsError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  /** Bumped only on explicit navigation (new chat / pick a different conversation) to remount ChatWindow — never when a chat gets its id assigned mid-stream, which must keep the same instance so the reply in progress isn't lost. */
  const [windowKey, setWindowKey] = useState(0);

  const refresh = useCallback(() => {
    aiService
      .listConversations()
      .then((data) => {
        setConversations(data);
        setConversationsError(false);
      })
      .catch(() => setConversationsError(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleSelect(id: string | null) {
    setSelectedId(id);
    setWindowKey((k) => k + 1);
  }

  function handleConversationCreated(id: string) {
    setSelectedId(id);
    refresh();
  }

  function handleConversationDeleted(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      setWindowKey((k) => k + 1);
    }
    refresh();
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    await aiService.deleteConversation(id).catch(() => undefined);
    handleConversationDeleted(id);
  }

  return (
    <div className="flex h-full">
      <ChatSidebar
        conversations={conversations}
        error={conversationsError}
        onRetry={refresh}
        selectedId={selectedId}
        onSelect={handleSelect}
        onNew={() => handleSelect(null)}
        onDelete={setPendingDeleteId}
      />
      <ChatWindow
        key={windowKey}
        conversationId={selectedId}
        onConversationCreated={handleConversationCreated}
        onConversationChanged={refresh}
        onConversationDeleted={handleConversationDeleted}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete this conversation?"
        description="This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
