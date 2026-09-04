"use client";

import { EMAIL_VARIABLE_GROUPS } from "@/lib/email-campaigns/variables";

/** Shared by the template editor and the campaign wizard's Compose step — renders EMAIL_VARIABLE_GROUPS as clickable chips that insert {{key}} at the cursor. */
export function VariablePicker({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="space-y-3">
      {EMAIL_VARIABLE_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.fields.map((field) => (
              <button
                key={field.key}
                type="button"
                // Keeps focus (and the current cursor position) inside the
                // rich text editor's contentEditable div — without this, the
                // click would steal focus before execCommand runs, and the
                // token would land nowhere / at the wrong spot. Same trick
                // RichTextEditor's own toolbar buttons already use.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsert(field.key)}
                title={field.label}
                className="rounded-full border border-border bg-background px-2 py-1 font-mono text-xs text-foreground transition-colors hover:border-primary-500 hover:text-primary-700"
              >
                {`{{${field.key}}}`}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
