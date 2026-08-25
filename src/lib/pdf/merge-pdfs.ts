import { PDFDocument } from "pdf-lib";

/**
 * Concatenates rendered card PDFs into one document.
 *
 * Lived inside the bulk-generation route; the "download selected" action is a
 * second consumer, so it moved here rather than being copied.
 */
export async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return Buffer.from(await merged.save());
}
