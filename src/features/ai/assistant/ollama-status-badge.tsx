"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { aiService } from "@/services/aiService";
import type { AiHealthStatus } from "@/types/ai";

/** Polls /api/ai/health so the header always reflects whether the active AI provider (Ollama or OmniRoute — see src/lib/ai/config.ts) is actually reachable — never a static "connected" label. */
export function OllamaStatusBadge() {
  const [status, setStatus] = useState<AiHealthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const result = await aiService.health();
        if (!cancelled) setStatus(result);
      } catch {
        if (!cancelled) setStatus({ connected: false, model: "", modelAvailable: false, responseTimeMs: null });
      }
    }
    check();
    const interval = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!status) {
    return (
      <Badge variant="neutral" className="gap-1.5">
        <span className="size-1.5 rounded-full bg-muted-foreground" />
        Checking…
      </Badge>
    );
  }

  if (!status.connected) {
    return (
      <Badge variant="danger" className="gap-1.5" title="Ollama is not reachable. Make sure the local AI service is running.">
        <span className="size-1.5 rounded-full bg-danger-600" />
        AI Offline
      </Badge>
    );
  }

  if (!status.modelAvailable) {
    return (
      <Badge variant="warning" className="gap-1.5" title={`Model "${status.model}" is not pulled yet.`}>
        <span className="size-1.5 rounded-full bg-warning-500" />
        Model unavailable
      </Badge>
    );
  }

  return (
    <Badge variant="success" className="gap-1.5" title={`${status.model} · ${status.responseTimeMs}ms`}>
      <span className="size-1.5 rounded-full bg-accent-600" />
      AI Connected
    </Badge>
  );
}
