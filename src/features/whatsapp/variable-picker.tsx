"use client";

import { WHATSAPP_VARIABLE_GROUPS } from "@/lib/whatsapp/variables";

/** Shared by the template editor and the campaign wizard's Message step — renders WHATSAPP_VARIABLE_GROUPS as clickable chips that insert {{key}} into the message. */
export function VariablePicker({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="space-y-3">
      {WHATSAPP_VARIABLE_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.fields.map((field) => (
              <button
                key={field.key}
                type="button"
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
