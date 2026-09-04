import type { GeneratedReport } from "@/types/ai-reports";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphs(text: string): string {
  return (text || "—")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join("");
}

/** Opens a clean, minimal print window scoped to just the report — avoids fighting the app shell's sidebar/topnav CSS for a print stylesheet. */
export function printReport(report: GeneratedReport): void {
  const win = window.open("", "_blank", "width=850,height=1100");
  if (!win) return;

  const statsHtml = report.keyStatistics.map((s) => `<div class="stat"><span class="label">${escapeHtml(s.label)}</span><span class="value">${escapeHtml(s.value)}</span></div>`).join("");

  const NARRATIVE_SECTIONS: [string, keyof GeneratedReport][] = [
    ["Executive Summary", "executiveSummary"],
    ["Observations", "observations"],
    ["Areas of Concern", "areasOfConcern"],
    ["Recommendations", "recommendations"],
    ["Conclusion", "conclusion"],
  ];
  const sectionsHtml = report.narrativeError
    ? `<h2>AI Narrative</h2><p class="muted">${escapeHtml(report.narrativeError)}</p>`
    : NARRATIVE_SECTIONS.map(([title, key]) => `<h2>${title}</h2>${paragraphs(String(report[key] ?? ""))}`).join("");

  const tableHtml = report.tableRows.length
    ? `<h2>${escapeHtml(report.tableTitle)}</h2><table><thead><tr>${report.tableColumns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>${report.tableRows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`
    : "";

  win.document.write(`<!doctype html>
<html>
<head>
<title>${escapeHtml(report.title)}</title>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1a1a1a; padding: 32px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
  h2 { font-size: 14px; margin-top: 20px; margin-bottom: 6px; color: #1e3a8a; }
  p { font-size: 13px; line-height: 1.5; margin: 4px 0; }
  .muted { color: #666; }
  .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
  .stat { border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 13px; }
  .stat .label { color: #666; }
  .stat .value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(report.title)}</h1>
  <div class="meta">${escapeHtml(report.periodLabel)} · ${escapeHtml(report.filtersLabel)} · Generated ${escapeHtml(new Date(report.generatedAt).toLocaleString("en-IN"))}</div>
  <h2>Key Statistics</h2>
  <div class="stats">${statsHtml}</div>
  ${sectionsHtml}
  ${tableHtml}
</body>
</html>`);
  win.document.close();
  win.focus();
  win.print();
}
