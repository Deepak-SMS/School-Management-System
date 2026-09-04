import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import { amountInWords } from "@/lib/pdf/render-receipt-pdf";
import type { PayLine } from "@/lib/payroll/calculate";

/**
 * The printable salary slip: A4 portrait, one page. Every figure printed
 * comes from the PayrollEntry row (a snapshot taken at calculation time),
 * never from a live lookup — reprinting a slip months later must always show
 * exactly what was paid, even if the staff member's structure or the
 * school's payroll rules have since changed.
 */

const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const MARGIN = 40;

const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.52);
const RULE = rgb(0.85, 0.87, 0.91);
const ACCENT = rgb(0.15, 0.39, 0.92);

export interface SalarySlipPdfData {
  slipNumber: string;
  generatedAt: Date;

  schoolName: string;
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;

  employeeName: string;
  employeeId: string;
  designation?: string | null;
  department?: string | null;
  payPeriodLabel: string;
  bankAccountNumber?: string | null;
  bankName?: string | null;

  workingDays: number;
  payableDays: number;

  earnings: PayLine[];
  deductions: PayLine[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;

  logoBytes?: Buffer | null;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Indian digit grouping — 1,23,456.00 rather than 123,456.00. */
function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

export async function renderSalarySlipPdf(data: SalarySlipPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4_PORTRAIT.width, A4_PORTRAIT.height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const right = A4_PORTRAIT.width - MARGIN;
  const contentWidth = right - MARGIN;
  let y = A4_PORTRAIT.height - MARGIN;

  // --- Header: logo and school identity ---
  let textLeft = MARGIN;
  if (data.logoBytes) {
    try {
      const isPng = data.logoBytes[0] === 0x89 && data.logoBytes[1] === 0x50;
      const image = isPng ? await doc.embedPng(data.logoBytes) : await doc.embedJpg(data.logoBytes);
      const boxHeight = 46;
      const scale = boxHeight / image.height;
      const width = Math.min(image.width * scale, 90);
      page.drawImage(image, { x: MARGIN, y: y - boxHeight, width, height: boxHeight });
      textLeft = MARGIN + width + 12;
    } catch {
      textLeft = MARGIN;
    }
  }

  page.drawText(fit(data.schoolName, bold, 16, right - textLeft - 150), { x: textLeft, y: y - 15, size: 16, font: bold, color: INK });

  let headerY = y - 30;
  for (const line of [data.schoolAddress, [data.schoolPhone, data.schoolEmail].filter(Boolean).join("  ·  ")]) {
    if (!line) continue;
    page.drawText(fit(line, font, 8, right - textLeft - 150), { x: textLeft, y: headerY, size: 8, font, color: MUTED });
    headerY -= 11;
  }

  page.drawText("SALARY SLIP", { x: right - 110, y: y - 15, size: 13, font: bold, color: ACCENT });
  page.drawText(data.payPeriodLabel, { x: right - font.widthOfTextAtSize(data.payPeriodLabel, 9), y: y - 30, size: 9, font, color: MUTED });

  y = Math.min(headerY, y - 52) - 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 18;

  // --- Employee identity, two columns ---
  const midX = MARGIN + contentWidth / 2;

  function labelled(x: number, top: number, rows: [string, string][], width: number): number {
    let rowY = top;
    for (const [label, value] of rows) {
      if (!value) continue;
      page.drawText(label, { x, y: rowY, size: 7, font, color: MUTED });
      page.drawText(fit(value, bold, 9, width), { x, y: rowY - 11, size: 9, font: bold, color: INK });
      rowY -= 26;
    }
    return rowY;
  }

  const leftEnd = labelled(
    MARGIN,
    y,
    [
      ["EMPLOYEE", data.employeeName],
      ["EMPLOYEE ID", data.employeeId],
      ["DESIGNATION", data.designation ?? "—"],
    ],
    contentWidth / 2 - 16,
  );

  const rightEnd = labelled(
    midX,
    y,
    [
      ["DEPARTMENT", data.department ?? "—"],
      ["WORKING DAYS", String(data.workingDays)],
      ["PAYABLE DAYS", String(data.payableDays)],
    ],
    contentWidth / 2 - 16,
  );

  y = Math.min(leftEnd, rightEnd) + 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 16;

  // --- Earnings / Deductions, side by side ---
  const colWidth = contentWidth / 2 - 12;
  const earnX = MARGIN;
  const dedX = midX + 12;

  page.drawText("EARNINGS", { x: earnX, y, size: 8, font: bold, color: MUTED });
  page.drawText("DEDUCTIONS", { x: dedX, y, size: 8, font: bold, color: MUTED });
  y -= 14;
  page.drawLine({ start: { x: earnX, y: y + 4 }, end: { x: earnX + colWidth, y: y + 4 }, thickness: 0.5, color: RULE });
  page.drawLine({ start: { x: dedX, y: y + 4 }, end: { x: dedX + colWidth, y: y + 4 }, thickness: 0.5, color: RULE });

  function drawLines(x: number, top: number, lines: PayLine[], width: number): number {
    let rowY = top;
    for (const line of lines) {
      page.drawText(fit(line.label, font, 9, width - 60), { x, y: rowY, size: 9, font, color: INK });
      const text = money(line.amount);
      page.drawText(text, { x: x + width - font.widthOfTextAtSize(text, 9), y: rowY, size: 9, font, color: INK });
      rowY -= 15;
    }
    return rowY;
  }

  const earnEnd = drawLines(earnX, y, data.earnings, colWidth);
  const dedEnd = drawLines(dedX, y, data.deductions.length > 0 ? data.deductions : [{ label: "—", amount: 0 }], colWidth);
  y = Math.min(earnEnd, dedEnd) - 4;

  page.drawLine({ start: { x: earnX, y: y + 10 }, end: { x: earnX + colWidth, y: y + 10 }, thickness: 0.5, color: RULE });
  page.drawLine({ start: { x: dedX, y: y + 10 }, end: { x: dedX + colWidth, y: y + 10 }, thickness: 0.5, color: RULE });

  function totalRow(x: number, top: number, label: string, value: number, width: number) {
    page.drawText(label, { x, y: top, size: 9, font: bold, color: INK });
    const text = money(value);
    page.drawText(text, { x: x + width - bold.widthOfTextAtSize(text, 9), y: top, size: 9, font: bold, color: INK });
  }

  totalRow(earnX, y, "Gross Earnings", data.grossSalary, colWidth);
  totalRow(dedX, y, "Total Deductions", data.totalDeductions, colWidth);
  y -= 26;

  // --- Net salary ---
  page.drawRectangle({ x: MARGIN, y: y - 10, width: contentWidth, height: 34, color: rgb(0.96, 0.97, 0.99) });
  page.drawText("NET SALARY", { x: MARGIN + 12, y: y + 4, size: 10, font: bold, color: MUTED });
  const netText = `Rs. ${money(data.netSalary)}`;
  page.drawText(netText, { x: right - 12 - bold.widthOfTextAtSize(netText, 15), y: y, size: 15, font: bold, color: ACCENT });
  y -= 30;

  page.drawText(fit(`Amount in words: ${amountInWords(data.netSalary)}`, font, 8, contentWidth), { x: MARGIN, y, size: 8, font, color: INK });
  y -= 20;

  if (data.bankName || data.bankAccountNumber) {
    page.drawText(
      fit(`Paid to: ${data.bankName ?? ""} ${data.bankAccountNumber ? `A/C ${data.bankAccountNumber}` : ""}`.trim(), font, 8, contentWidth),
      { x: MARGIN, y, size: 8, font, color: MUTED },
    );
    y -= 16;
  }

  // --- Footer ---
  const footerY = MARGIN + 6;
  page.drawText(`Slip No. ${data.slipNumber} · Generated ${formatDate(data.generatedAt)}`, { x: MARGIN, y: footerY, size: 7, font, color: MUTED });
  const note = "Computer-generated document — no signature required.";
  page.drawText(note, { x: right - font.widthOfTextAtSize(note, 7), y: footerY, size: 7, font, color: MUTED });

  return Buffer.from(await doc.save());
}
