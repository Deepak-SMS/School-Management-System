"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Heading2, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const TOOLBAR_BUTTONS: { command: string; icon: typeof Bold; label: string }[] = [
  { command: "bold", icon: Bold, label: "Bold" },
  { command: "italic", icon: Italic, label: "Italic" },
  { command: "underline", icon: Underline, label: "Underline" },
  { command: "formatBlock", icon: Heading2, label: "Heading" },
  { command: "insertUnorderedList", icon: List, label: "Bulleted list" },
  { command: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
  { command: "insertHorizontalRule", icon: Minus, label: "Divider" },
];

const COMMAND_ARGS: Record<string, string> = { formatBlock: "H2" };

/**
 * A small contentEditable + toolbar editor (bold/italic/underline/heading/
 * lists/link/divider) — no WYSIWYG framework dependency. Alignment, font
 * size, and real table editing are deliberately not included — execCommand's
 * output for those is either legacy-tag-heavy or a poor editing experience,
 * not worth it for a "does not need to replicate Canva" editor (email
 * templates' spec §10). The HTML it emits is untrusted until it passes
 * through a server-side sanitizer (src/lib/sanitize-html.ts for News,
 * src/lib/email-campaigns/sanitize.ts for email) before storage; never trust
 * `value` as safe to render elsewhere without that step.
 */
export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current && ref.current) {
      ref.current.innerHTML = value;
      isFirstRender.current = false;
    }
  }, [value]);

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onChange(ref.current?.innerHTML ?? "");
  }

  function handleLink() {
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  }

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-md border border-border-strong bg-surface", className)}>
      <div className="flex items-center gap-1 border-b border-border bg-background px-2 py-1.5">
        {TOOLBAR_BUTTONS.map(({ command, icon: Icon, label }) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(command, COMMAND_ARGS[command])}
            className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
        <button
          type="button"
          aria-label="Insert link"
          title="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleLink}
          className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
        >
          <Link2 className="size-3.5" />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        data-placeholder={placeholder}
        className="min-h-40 flex-1 overflow-y-auto px-3 py-2 text-sm text-foreground outline-none [&:empty]:before:text-muted-foreground [&:empty]:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
