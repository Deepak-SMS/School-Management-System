import sanitizeHtml from "sanitize-html";

/**
 * News articles are authored via a rich-text editor and rendered as raw HTML
 * for every viewer of that school — an allow-list sanitizer here is a real
 * XSS control, not a formality. Keep this list in sync with the buttons
 * `RichTextEditor` actually exposes (src/components/ui/rich-text-editor.tsx).
 */
export function sanitizeNewsHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "b", "strong", "i", "em", "u", "ul", "ol", "li", "a",
      "h2", "h3", "blockquote", "table", "thead", "tbody", "tr", "td", "th",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}
