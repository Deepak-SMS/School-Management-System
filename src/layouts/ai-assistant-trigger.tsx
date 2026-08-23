"use client";

import { Sparkles } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export function AiAssistantTrigger() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-md text-primary-600 transition-colors hover:bg-primary-50 dark:hover:bg-primary-500/10"
          aria-label="AI assistant"
        >
          <Sparkles className="size-4.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">School AI</p>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The AI assistant lands in Phase 14, once there&apos;s real student, attendance, and fee data for it to
          reason over. This icon is reserved for it now so the layout doesn&apos;t shift later.
        </p>
      </PopoverContent>
    </Popover>
  );
}
