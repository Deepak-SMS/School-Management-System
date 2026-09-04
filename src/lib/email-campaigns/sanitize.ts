import sanitizeHtml from "sanitize-html";

/**
 * Email templates are authored via the same contentEditable RichTextEditor
 * News uses, but sent as raw HTML straight into a real inbox — an allow-list
 * sanitizer here is the actual XSS control (spec §21/45), not a formality.
 * A separate allowlist from src/lib/sanitize-html.ts's sanitizeNewsHtml
 * (rather than extending it) because email genuinely needs different things
 * — inline `style` for basic color/alignment, `hr` for the divider button —
 * that a school-wide rendered news article doesn't, and this keeps the two
 * XSS surfaces independently reviewable.
 */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "b", "strong", "i", "em", "u", "ul", "ol", "li", "a",
      "h1", "h2", "h3", "blockquote", "div", "span",
      "table", "thead", "tbody", "tr", "td", "th",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      "*": ["style"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/],
        "text-align": [/^left$|^right$|^center$/],
        "font-weight": [/^bold$|^normal$|^\d+$/],
        "font-size": [/^\d+(px|pt|em)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

/** Strips tags for the plain-text fallback part of the email — a crude but honest conversion, not meant to be pretty, just readable. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/h[1-3]|\/li|\/tr)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
