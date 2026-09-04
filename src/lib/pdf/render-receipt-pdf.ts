import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import type { ReceiptComponent } from "@/lib/fees/record-payment";

/**
 * The printable fee receipt: A5 landscape, which is the size most schools'
 * receipt books already are and what fits two to an A4 sheet.
 *
 * Everything printed comes from the receipt row, never from a live lookup — the
 * school name and logo are the ones captured when the receipt was issued, so a
 * reprint years later still shows what the family was handed.
 */

const A5_LANDSCAPE = { width: 595.28, height: 419.53 };
const MARGIN = 28;

const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.52);
const RULE = rgb(0.85, 0.87, 0.91);
const ACCENT = rgb(0.15, 0.39, 0.92);
const VOID_RED = rgb(0.86, 0.15, 0.15);

export interface ReceiptPdfData {
  receiptNumber: string;
  issuedOn: Date;
  status: string;
  voidReason?: string | null;

  schoolName: string;
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;

  studentName: string;
  admissionNumber: string;
  className?: string | null;
  sectionName?: string | null;
  academicYear?: string | null;

  amountPaid: number;
  methodLabel: string;
  referenceNo?: string | null;
  invoiceRef?: string | null;
  paidOn: Date;
  balanceAfter: number;
  components: ReceiptComponent[];

  receivedBy?: string | null;
  /** PNG or JPEG bytes of the school logo, fetched from the School Profile. */
  logoBytes?: Buffer | null;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Indian digit grouping — 1,23,456.00 rather than 123,456.00. */
function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

/**
 * Amount in words, which a fee receipt is expected to carry — it's what stops a
 * printed figure being altered after the fact. Lakh/crore grouping, to match
 * the numerals above it.
 */
export function amountInWords(value: number): string {
  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = Math.floor((rupees % 1000) / 100);
  const rest = rupees % 100;

  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));

  const words = `${parts.join(" ")} Rupees`;
  return paise > 0 ? `${words} and ${twoDigits(paise)} Paise Only` : `${words} Only`;
}

/** Trims text to fit a column, so a long fee label can't run into the next one. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

export async function renderReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A5_LANDSCAPE.width, A5_LANDSCAPE.height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const right = A5_LANDSCAPE.width - MARGIN;
  const contentWidth = right - MARGIN;
  let y = A5_LANDSCAPE.height - MARGIN;

  // --- Header: logo and school identity, both from the School Profile ---
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
      // An unreadable logo must never stop a family getting their receipt.
      textLeft = MARGIN;
    }
  }

  page.drawText(fit(data.schoolName, bold, 15, right - textLeft - 150), {
    x: textLeft,
    y: y - 14,
    size: 15,
    font: bold,
    color: INK,
  });

  let headerY = y - 28;
  for (const line of [data.schoolAddress, [data.schoolPhone, data.schoolEmail].filter(Boolean).join("  ·  ")]) {
    if (!line) continue;
    page.drawText(fit(line, font, 7.5, right - textLeft - 150), {
      x: textLeft,
      y: headerY,
      size: 7.5,
      font,
      color: MUTED,
    });
    headerY -= 10;
  }

  page.drawText("FEE RECEIPT", { x: right - 96, y: y - 14, size: 12, font: bold, color: ACCENT });

  y = Math.min(headerY, y - 52) - 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 18;

  // --- Receipt and student identity, two columns ---
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
      ["RECEIPT NO.", data.receiptNumber],
      ["STUDENT", data.studentName],
      ["CLASS", [data.className, data.sectionName].filter(Boolean).join(" - ") || "—"],
    ],
    contentWidth / 2 - 16,
  );

  const rightEnd = labelled(
    midX,
    y,
    [
      ["PAYMENT DATE", formatDate(data.paidOn)],
      ["ADMISSION NO.", data.admissionNumber],
      ["ACADEMIC YEAR", data.academicYear ?? "—"],
    ],
    contentWidth / 2 - 16,
  );

  y = Math.min(leftEnd, rightEnd) + 8;

  // --- Fee components ---
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 14;

  const colLabel = MARGIN;
  const colCharged = right - 260;
  const colPaid = right - 170;
  const colDue = right - 80;

  page.drawText("FEE COMPONENT", { x: colLabel, y, size: 7, font: bold, color: MUTED });
  for (const [text, x] of [
    ["CHARGED", colCharged],
    ["PAID NOW", colPaid],
    ["BALANCE", colDue],
  ] as [string, number][]) {
    const width = bold.widthOfTextAtSize(text, 7);
    page.drawText(text, { x: x + 70 - width, y, size: 7, font: bold, color: MUTED });
  }
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.5, color: RULE });
  y -= 14;

  // Enough rows for a normal term bill; anything longer is summarised so the
  // receipt stays one page and the totals are never pushed off it.
  const MAX_ROWS = 6;
  const shown = data.components.slice(0, MAX_ROWS);
  const overflow = data.components.slice(MAX_ROWS);

  for (const c of shown) {
    page.drawText(fit(c.label, font, 9, colCharged - colLabel - 12), { x: colLabel, y, size: 9, font, color: INK });
    for (const [value, x] of [
      [c.charged, colCharged],
      [c.paidNow, colPaid],
      [c.outstanding, colDue],
    ] as [number, number][]) {
      const text = money(value);
      const width = font.widthOfTextAtSize(text, 9);
      page.drawText(text, { x: x + 70 - width, y, size: 9, font, color: INK });
    }
    y -= 16;
  }

  if (overflow.length > 0) {
    const summary = `+ ${overflow.length} more component${overflow.length === 1 ? "" : "s"}`;
    const paidNow = overflow.reduce((n, c) => n + c.paidNow, 0);
    page.drawText(summary, { x: colLabel, y, size: 9, font, color: MUTED });
    const text = money(paidNow);
    page.drawText(text, { x: colPaid + 70 - font.widthOfTextAtSize(text, 9), y, size: 9, font, color: INK });
    y -= 16;
  }

  y -= 2;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 18;

  // --- Totals ---
  function total(label: string, value: string, size: number, useBold: boolean, top: number) {
    const f = useBold ? bold : font;
    page.drawText(label, { x: colPaid, y: top, size: 8, font, color: MUTED });
    const width = f.widthOfTextAtSize(value, size);
    page.drawText(value, { x: colDue + 70 - width, y: top - (size > 10 ? 2 : 0), size, font: f, color: INK });
  }

  total("AMOUNT PAID", `Rs. ${money(data.amountPaid)}`, 13, true, y);
  y -= 20;
  total("BALANCE DUE", `Rs. ${money(data.balanceAfter)}`, 10, false, y);

  // --- Payment details, left of the totals ---
  let detailY = y + 20;
  const details: [string, string][] = [
    ["Payment method", data.methodLabel],
    ["Reference", data.referenceNo || "—"],
    ["Invoice", data.invoiceRef || "—"],
  ];
  for (const [label, value] of details) {
    page.drawText(`${label}:`, { x: MARGIN, y: detailY, size: 8, font, color: MUTED });
    page.drawText(fit(value, font, 8, 150), { x: MARGIN + 78, y: detailY, size: 8, font, color: INK });
    detailY -= 12;
  }

  y = Math.min(y, detailY) - 12;
  page.drawText(fit(`Amount in words: ${amountInWords(data.amountPaid)}`, font, 8, contentWidth), {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: INK,
  });

  // --- Footer ---
  const footerY = MARGIN + 6;
  page.drawText(`Issued ${formatDate(data.issuedOn)}${data.receivedBy ? ` by ${data.receivedBy}` : ""}`, {
    x: MARGIN,
    y: footerY,
    size: 7,
    font,
    color: MUTED,
  });
  const note = "Computer-generated receipt.";
  page.drawText(note, { x: right - font.widthOfTextAtSize(note, 7), y: footerY, size: 7, font, color: MUTED });

  // --- Void overlay ---
  // Drawn last so it sits over the figures: a voided receipt in circulation must
  // never be mistakable for a live one.
  if (data.status === "void") {
    page.drawText("VOID", {
      x: A5_LANDSCAPE.width / 2 - 110,
      y: A5_LANDSCAPE.height / 2 - 30,
      size: 90,
      font: bold,
      color: VOID_RED,
      opacity: 0.22,
      rotate: { type: "degrees", angle: 18 } as never,
    });
    if (data.voidReason) {
      page.drawText(fit(`Cancelled: ${data.voidReason}`, font, 8, contentWidth), {
        x: MARGIN,
        y: footerY + 12,
        size: 8,
        font,
        color: VOID_RED,
      });
    }
  }

  return Buffer.from(await doc.save());
}
