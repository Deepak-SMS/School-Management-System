import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { GeneratedReport } from "@/lib/ai/reports/types";

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * pdf-lib's standard fonts (Helvetica) only support WinAnsi encoding —
 * text the LLM writes (smart quotes, em dashes, or anything non-Latin if a
 * report narrative ever includes a language other than English) can easily
 * fall outside that and crash `drawText`/`widthOfTextAtSize` outright. Every
 * string reaches this before either is called.
 */
function sanitizeForPdf(text: string): string {
  return text
    .replace(/₹/g, "Rs.") // rupee sign — not in WinAnsi at all, and common enough in these reports to deserve better than "?"
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[  -​]/g, " ")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(trial, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/** Renders a GeneratedReport as a simple, print-ready, multi-page A4 PDF — plain text layout, no design template, since this is a data report rather than a branded document. */
export async function renderReportPdf(report: GeneratedReport): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(height: number) {
    if (y - height < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawHeading(text: string, size = 13) {
    ensureSpace(size * 1.8);
    page.drawText(sanitizeForPdf(text), { x: MARGIN, y, size, font: bold, color: rgb(0.13, 0.13, 0.45) });
    y -= size * 1.8;
  }

  function drawParagraph(text: string, opts: { size?: number; gapAfter?: number; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 10;
    const color = opts.color ?? [0.1, 0.1, 0.12];
    const lineHeight = size * 1.45;
    const paragraphs = sanitizeForPdf(text || "-").split("\n");
    for (const para of paragraphs) {
      if (!para.trim()) {
        y -= lineHeight * 0.5;
        continue;
      }
      for (const line of wrapText(para, font, size, CONTENT_WIDTH)) {
        ensureSpace(lineHeight);
        page.drawText(line, { x: MARGIN, y, size, font, color: rgb(...color) });
        y -= lineHeight;
      }
    }
    y -= opts.gapAfter ?? 8;
  }

  drawHeading(report.title, 18);
  drawParagraph(`${report.periodLabel}  -  ${report.filtersLabel}`, { size: 9, color: [0.45, 0.45, 0.48], gapAfter: 4 });
  drawParagraph(`Generated ${new Date(report.generatedAt).toLocaleString("en-IN")}`, { size: 8, color: [0.55, 0.55, 0.58], gapAfter: 14 });

  drawHeading("Key Statistics");
  for (const stat of report.keyStatistics) drawParagraph(`${stat.label}: ${stat.value}`, { gapAfter: 2 });
  y -= 8;

  const sections: [string, string][] = [
    ["Executive Summary", report.executiveSummary],
    ["Observations", report.observations],
    ["Areas of Concern", report.areasOfConcern],
    ["Recommendations", report.recommendations],
    ["Conclusion", report.conclusion],
  ];
  if (report.narrativeError) {
    drawHeading("AI Narrative");
    drawParagraph(report.narrativeError, { color: [0.6, 0.35, 0.1] });
  } else {
    for (const [heading, body] of sections) {
      drawHeading(heading);
      drawParagraph(body);
    }
  }

  if (report.tableRows.length > 0) {
    drawHeading(report.tableTitle);
    drawParagraph(report.tableColumns.join("  |  "), { size: 9, gapAfter: 4 });
    for (const row of report.tableRows) drawParagraph(row.join("  |  "), { size: 9, gapAfter: 3 });
  }

  return Buffer.from(await doc.save());
}
