const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/**
 * Every distinct {{token}} referenced in a template body — used by the
 * template editor's "uses:" chip list and cached into *Template.variablesJson.
 * Shared across every communication channel (WhatsApp, Email, and future
 * SMS/Push) so the token syntax and extraction behave identically everywhere.
 */
export function extractVariables(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN_RE)].map((m) => m[1]))];
}

export interface PersonalizeResult {
  text: string;
  /** Tokens present in the template that had no value for this recipient — left as the literal {{token}} in `text` so a gap is visible, never silently blanked. */
  missingVariables: string[];
}

/**
 * Reuses the {{field.key}} dot-path naming convention already established by
 * src/lib/certificates/resolve-fields.ts — but that resolver feeds a bound
 * canvas element, not free text, so this replacement engine is new. Plain
 * substitution, no escaping — correct for plain-text bodies (WhatsApp,
 * subject lines, the plain-text half of an email) but NOT for HTML; use
 * personalizeHtml for that.
 */
export function personalizeMessage(template: string, values: Record<string, string>): PersonalizeResult {
  const missing: string[] = [];
  const text = template.replace(TOKEN_RE, (whole, key: string) => {
    const v = values[key];
    if (v === undefined || v === "") {
      missing.push(key);
      return whole;
    }
    return v;
  });
  return { text, missingVariables: [...new Set(missing)] };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Same substitution as personalizeMessage, but HTML-escapes each value first
 * — the template HTML itself is trusted (already passed through
 * src/lib/email-campaigns/sanitize.ts before storage), but a variable's
 * *value* (a guardian's name, a note field) is real user-entered data that
 * must never be interpreted as markup once spliced into that trusted shell.
 */
export function personalizeHtml(template: string, values: Record<string, string>): PersonalizeResult {
  const missing: string[] = [];
  const text = template.replace(TOKEN_RE, (whole, key: string) => {
    const v = values[key];
    if (v === undefined || v === "") {
      missing.push(key);
      return whole;
    }
    return escapeHtml(v);
  });
  return { text, missingVariables: [...new Set(missing)] };
}
