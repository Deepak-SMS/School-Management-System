import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage } from "pdf-lib";
import QRCode from "qrcode";

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
  fontSize?: number | null;
  fontWeight?: string | null;
  textAlign?: string | null;
  color?: string | null;
  backgroundColor?: string | null;
  zIndex: number;
}

export interface RenderCardPdfParams {
  cardWidthMm: number;
  cardHeightMm: number;
  elements: DesignElementLike[];
  fieldValues: Record<string, string>;
  /** The verification URL encoded by any `qrcode` element on the template. */
  qrValue?: string;
  photoBytes?: Buffer | null;
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
  const { cardWidthMm, cardHeightMm, elements, fieldValues, qrValue, photoBytes } = params;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const widthPt = cardWidthMm * MM_TO_PT;
  const heightPt = cardHeightMm * MM_TO_PT;
  const sides = elements.some((e) => e.side === "back") ? ["front", "back"] : ["front"];

  let qrImage: PDFImage | undefined;
  if (qrValue && elements.some((e) => e.type === "qrcode" || e.type === "barcode")) {
    const qrPng = await QRCode.toBuffer(qrValue, { margin: 0, width: 512 });
    qrImage = await doc.embedPng(qrPng);
  }

  let photoImage: PDFImage | undefined;
  if (photoBytes) {
    photoImage = await embedPhoto(doc, photoBytes);
  }

  for (const side of sides) {
    const page = doc.addPage([widthPt, heightPt]);
    const sideElements = elements.filter((e) => e.side === side).sort((a, b) => a.zIndex - b.zIndex);

    for (const el of sideElements) {
      drawElement(page, el, { widthPt, heightPt, font, fontBold, fieldValues, qrImage, photoImage });
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
    photoImage?: PDFImage;
  },
) {
  const xPt = el.x * MM_TO_PT;
  const wPt = el.width * MM_TO_PT;
  const hPt = el.height * MM_TO_PT;
  const yPt = ctx.heightPt - el.y * MM_TO_PT - hPt;

  if (el.type === "shape") {
    const [r, g, b] = hexToRgb01(el.backgroundColor);
    page.drawRectangle({ x: xPt, y: yPt, width: wPt, height: hPt, color: rgb(r, g, b) });
    return;
  }

  if (el.type === "photo") {
    if (ctx.photoImage) {
      page.drawImage(ctx.photoImage, { x: xPt, y: yPt, width: wPt, height: hPt });
    } else {
      const [r, g, b] = hexToRgb01(el.backgroundColor || "#e5e7eb");
      page.drawRectangle({ x: xPt, y: yPt, width: wPt, height: hPt, color: rgb(r, g, b) });
    }
    return;
  }

  if (el.type === "logo") {
    const [r, g, b] = hexToRgb01("#f3f4f6");
    page.drawRectangle({ x: xPt, y: yPt, width: wPt, height: hPt, color: rgb(r, g, b) });
    return;
  }

  if (el.type === "signature") {
    page.drawLine({ start: { x: xPt, y: yPt }, end: { x: xPt + wPt, y: yPt }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    return;
  }

  if (el.type === "qrcode" || el.type === "barcode") {
    if (ctx.qrImage) page.drawImage(ctx.qrImage, { x: xPt, y: yPt, width: wPt, height: hPt });
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
  page.drawText(text, { x: textX, y: textY, size, font: useFont, color: rgb(r, g, b) });
}
