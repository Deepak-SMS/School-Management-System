import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders an assistant reply's Markdown (headings, lists, tables, code) using
 * the app's existing design tokens — no @tailwindcss/typography plugin is
 * installed, so element styling is spelled out here instead of via `prose`.
 */
const markdownComponents: Components = {
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  h1: ({ children }) => <h1 className="mt-3 mb-1.5 text-base font-semibold text-foreground first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-3 mb-1.5 text-sm font-semibold text-foreground first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold text-foreground first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary-600 underline underline-offset-2 hover:text-primary-700">
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-md bg-black/[.05] px-3 py-2 font-mono text-xs whitespace-pre dark:bg-white/[.08]">
          {children}
        </code>
      );
    }
    return <code className="rounded bg-black/[.06] px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/[.1]">{children}</code>;
  },
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-border-strong pl-3 text-muted-foreground italic">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
  th: ({ children }) => <th className="px-2 py-1 text-left font-semibold text-foreground">{children}</th>,
  td: ({ children }) => <td className="border-t border-border px-2 py-1 align-top">{children}</td>,
  hr: () => <hr className="my-2 border-border" />,
};

export function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-1 text-sm text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
