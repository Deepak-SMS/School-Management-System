import { PDFDocument, rgb, degrees, StandardFonts, type PDFFont, type PDFImage } from "pdf-lib";
import QRCode from "qrcode";
import { encodeCode128B } from "@/lib/id-cards/code128";

const MM_TO_PT = 72 / 25.4;

export interface DesignElementLike {
  side: string;
  type: string;
  fieldKey?: string | null;
  content?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, CSS convention (positive = visually clockwise) — matches the on-screen designer and every other renderer of this same field. */
  rotation?: number | null;
  fontSize?: number | null;
  fontWeight?: string | null;
  textAlign?: string | null;
  color?: string | null;
  backgroundColor?: string | null;
  zIndex: number;
}

/**
 * pdf-lib rotates a shape around the (x,y) anchor it's drawn at — for
 * `drawRectangle`/`drawImage` that's the bottom-left corner — while the
 * on-screen CSS preview (`transform: rotate()`) pivots around the element's
 * *center*. This computes the anchor pdf-lib needs so the two visually agree:
 * where the given `anchorX,anchorY` would land if the whole box were rotated
 * around `centerX,centerY` first. Also flips sign: PDF's y-axis points up,
 * CSS's points down, so a CSS-clockwise-positive rotation is PDF's
 * counterclockwise-positive rotation of the same magnitude negated.
 */
function rotatedAnchor(anchorX: number, anchorY: number, centerX: number, centerY: number, cssRotationDeg: number) {
  const pdfDeg = -(cssRotationDeg || 0);
  if (!pdfDeg) return { x: anchorX, y: anchorY, pdfDeg: 0 };
  const rad = (pdfDeg * Math.PI) / 180;
  const dx = anchorX - centerX;
  const dy = anchorY - centerY;
  return {
    x: centerX + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: centerY + dx * Math.sin(rad) + dy * Math.cos(rad),
    pdfDeg,
  };
}

export interface RenderCardPdfParams {
  cardWidthMm: number;
  cardHeightMm: number;
  elements: DesignElementLike[];
  fieldValues: Record<string, string>;
  /** The verification URL encoded by any `qrcode` element on the template. */
  qrValue?: string;
  /** The card/admission/employee number encoded by any `barcode` element (Code 128). Falls back to `qrValue` if omitted. */
  barcodeValue?: string;
  photoBytes?: Buffer | null;
  /** The school's logo, embedded into any `logo` element. */
  logoBytes?: Buffer | null;
}

function hexToRgb01(hex?: string | null): [number, number, number] {
  const fallback: [number, number, number] = [0.07, 0.09, 0.15];
  if (!hex || hex.length !== 7 || hex[0] !== "#") return fallback;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  if ([r, g, b].some(Number.isNaN)) return fallback;
  return [r, g, b];
}

/** Renders one card (front page, plus a back page if the template has back elements) as a print-ready PDF at the card's exact physical dimensions. */
export async function renderCardPdf(params: RenderCardPdfParams): Promise<Buffer> {
  const { cardWidthMm, cardHeightMm, elements, fieldValues, qrValue, barcodeValue, photoBytes, logoBytes } = params;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const widthPt = cardWidthMm * MM_TO_PT;
  const heightPt = cardHeightMm * MM_TO_PT;
  const sides = elements.some((e) => e.side === "back") ? ["front", "back"] : ["front"];

  let qrImage: PDFImage | undefined;
  if (qrValue && elements.some((e) => e.type === "qrcode")) {
    const qrPng = await QRCode.toBuffer(qrValue, { margin: 0, width: 512 });
    qrImage = await doc.embedPng(qrPng);
  }

  const barcodeWidths = elements.some((e) => e.type === "barcode") ? encodeCode128B(barcodeValue || qrValue || "") : [];

  let photoImage: PDFImage | undefined;
  if (photoBytes) {
    photoImage = await embedPhoto(doc, photoBytes);
  }

  let logoImage: PDFImage | undefined;
  if (logoBytes) {
    logoImage = await embedPhoto(doc, logoBytes);
  }

  for (const side of sides) {
    const page = doc.addPage([widthPt, heightPt]);
    const sideElements = elements.filter((e) => e.side === side).sort((a, b) => a.zIndex - b.zIndex);

    for (const el of sideElements) {
      drawElement(page, el, { widthPt, heightPt, font, fontBold, fieldValues, qrImage, barcodeWidths, photoImage, logoImage });
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function embedPhoto(doc: PDFDocument, bytes: Buffer): Promise<PDFImage | undefined> {
  try {
    return await doc.embedJpg(bytes);
  } catch {
    try {
      return await doc.embedPng(bytes);
    } catch {
      return undefined;
    }
  }
}

function drawElement(
  page: import("pdf-lib").PDFPage,
  el: DesignElementLike,
  ctx: {
    widthPt: number;
    heightPt: number;
    font: PDFFont;
    fontBold: PDFFont;
    fieldValues: Record<string, string>;
    qrImage?: PDFImage;
    barcodeWidths: number[];
    photoImage?: PDFImage;
    logoImage?: PDFImage;
  },
) {
  const xPt = el.x * MM_TO_PT;
  const wPt = el.width * MM_TO_PT;
  const hPt = el.height * MM_TO_PT;
  const yPt = ctx.heightPt - el.y * MM_TO_PT - hPt;
  const cx = xPt + wPt / 2;
  const cy = yPt + hPt / 2;
  const anchor = (ax: number, ay: number) => rotatedAnchor(ax, ay, cx, cy, el.rotation ?? 0);

  if (el.type === "shape") {
    const [r, g, b] = hexToRgb01(el.backgroundColor);
    const a = anchor(xPt, yPt);
    page.drawRectangle({ x: a.x, y: a.y, width: wPt, height: hPt, rotate: degrees(a.pdfDeg), color: rgb(r, g, b) });
    return;
  }

  if (el.type === "photo") {
    const a = anchor(xPt, yPt);
    if (ctx.photoImage) {
      page.drawImage(ctx.photoImage, { x: a.x, y: a.y, width: wPt, height: hPt, rotate: degrees(a.pdfDeg) });
    } else {
      const [r, g, b] = hexToRgb01(el.backgroundColor || "#e5e7eb");
      page.drawRectangle({ x: a.x, y: a.y, width: wPt, height: hPt, rotate: degrees(a.pdfDeg), color: rgb(r, g, b) });
    }
    return;
  }

  if (el.type === "logo") {
    if (ctx.logoImage) {
      const scaled = ctx.logoImage.scaleToFit(wPt, hPt);
      const dx = xPt + (wPt - scaled.width) / 2;
      const dy = yPt + (hPt - scaled.height) / 2;
      const a = anchor(dx, dy);
      page.drawImage(ctx.logoImage, { x: a.x, y: a.y, width: scaled.width, height: scaled.height, rotate: degrees(a.pdfDeg) });
    } else {
      const [r, g, b] = hexToRgb01("#f3f4f6");
      const a = anchor(xPt, yPt);
      page.drawRectangle({ x: a.x, y: a.y, width: wPt, height: hPt, rotate: degrees(a.pdfDeg), color: rgb(r, g, b) });
    }
    return;
  }

  if (el.type === "signature") {
    const start = anchor(xPt, yPt);
    const end = anchor(xPt + wPt, yPt);
    // drawLine has no `rotate` option — both endpoints are pre-rotated around the box center instead.
    page.drawLine({ start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    return;
  }

  if (el.type === "qrcode") {
    if (ctx.qrImage) {
      const a = anchor(xPt, yPt);
      page.drawImage(ctx.qrImage, { x: a.x, y: a.y, width: wPt, height: hPt, rotate: degrees(a.pdfDeg) });
    }
    return;
  }

  if (el.type === "barcode") {
    if (ctx.barcodeWidths.length === 0) return;
    const totalModules = ctx.barcodeWidths.reduce((a, b) => a + b, 0);
    const moduleWidth = wPt / totalModules;
    let cursor = xPt;
    ctx.barcodeWidths.forEach((width, i) => {
      const barWidth = width * moduleWidth;
      if (i % 2 === 0) {
        // Each bar rotates around the *whole barcode's* center, not its own — so the bars stay a coherent rotated block.
        const a = anchor(cursor, yPt);
        page.drawRectangle({ x: a.x, y: a.y, width: barWidth, height: hPt, rotate: degrees(a.pdfDeg), color: rgb(0, 0, 0) });
      }
      cursor += barWidth;
    });
    return;
  }

  // text | dynamic_field
  const text = el.content ?? (el.fieldKey ? (ctx.fieldValues[el.fieldKey] ?? "") : "");
  if (!text) return;
  const size = (el.fontSize ?? 5) * MM_TO_PT;
  const useFont = el.fontWeight === "bold" ? ctx.fontBold : ctx.font;
  const [r, g, b] = hexToRgb01(el.color);
  const textWidth = useFont.widthOfTextAtSize(text, size);
  let textX = xPt;
  if (el.textAlign === "center") textX = xPt + (wPt - textWidth) / 2;
  else if (el.textAlign === "right") textX = xPt + wPt - textWidth;
  const textY = yPt + (hPt - size) / 2 + size * 0.15;
  const a = anchor(textX, textY);
  page.drawText(text, { x: a.x, y: a.y, size, font: useFont, color: rgb(r, g, b), rotate: degrees(a.pdfDeg) });
}
