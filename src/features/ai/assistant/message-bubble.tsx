"use client";

import { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/providers/user-provider";
import { MessageMarkdown } from "@/features/ai/assistant/message-markdown";
import type { AiMessageRole } from "@/types/ai";

interface MessageBubbleProps {
  role: AiMessageRole;
  content: string;
  /** Still receiving chunks — suppresses the copy action and shows a live cursor. */
  streaming?: boolean;
}

export function MessageBubble({ role, content, streaming }: MessageBubbleProps) {
  const user = useCurrentUser();
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {isUser ? (
        <Avatar initials={user.avatarInitials} size="sm" />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </span>
      )}

      <div className={cn("group flex max-w-[75%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-lg px-3.5 py-2.5 text-sm",
            isUser ? "bg-primary-600 text-white" : "border border-border bg-surface text-foreground",
          )}
        >
          {isUser ? (
            <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
          ) : content ? (
            <MessageMarkdown content={content} />
          ) : (
            <span className="text-muted-foreground">Thinking…</span>
          )}
          {streaming && content && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-text-bottom" />}
        </div>

        {!isUser && !streaming && content && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100"
            onClick={handleCopy}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>
    </div>
  );
}
