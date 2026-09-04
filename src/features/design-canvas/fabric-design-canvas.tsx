"use client";

import { useEffect, useRef } from "react";
import {
  Canvas,
  Rect,
  Textbox,
  FabricImage,
  Group,
  FabricText,
  ActiveSelection,
  type FabricObject,
  type BasicTransformEvent,
  type TPointerEvent,
  type ModifiedEvent,
} from "fabric";
import { encodeCode128B } from "@/lib/id-cards/code128";

/**
 * The interactive edit surface for both the ID Card and Certificate
 * designers — everything the read-only gallery/preview renderers
 * (CardCanvasPreview, CertificateCanvasPreview) never needed. Those stay
 * DOM-based; this is the only place Fabric.js is used, so template
 * galleries showing several thumbnails at once never pay for a canvas each.
 *
 * mm is the unit of record everywhere outside this file (matches the Prisma
 * schema and every other renderer, including the PDF export). Internally,
 * Fabric objects live in "mm * MM_TO_PX" pixel space; display zoom is
 * applied via `canvas.setZoom()`, never baked into stored coordinates.
 */

export const MM_TO_PX = 3.7795; // 96dpi, matches every other renderer's mm->px assumption

export interface RenderableElement {
  id?: string;
  side: string;
  type: string;
  fieldKey?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number | null;
  fontSize?: number | null;
  fontFamily?: string | null;
  fontWeight?: string | null;
  textAlign?: string | null;
  letterSpacing?: number | null;
  lineHeight?: number | null;
  color?: string | null;
  backgroundColor?: string | null;
  borderWidth?: number | null;
  borderColor?: string | null;
  borderStyle?: string | null;
  opacity?: number | null;
  zIndex: number;
}

export interface ElementTransformPatch {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}

interface FabricDesignCanvasProps {
  pageWidthMm: number;
  pageHeightMm: number;
  cornerRadiusMm?: number;
  elements: RenderableElement[];
  /** Certificates are single-sided and omit this — defaults to "front". */
  side?: "front" | "back";
  sampleData?: Record<string, string>;
  /** Display zoom — 1 = true physical size on screen. */
  scale?: number;
  className?: string;
  selectedElementId?: string;
  schoolLogoUrl?: string | null;
  backgroundImageUrl?: string | null;
  barcodeValue?: string;
  onElementClick?: (element: RenderableElement) => void;
  /** Fired once per gesture, on pointer release — covers move, resize, and rotate alike. */
  onElementTransform?: (elementId: string, patch: ElementTransformPatch) => void;
  onElementDelete?: (elementId: string) => void;
  /** Fired when the user clicks empty canvas space, clearing the selection — new: the DOM version had no such interaction. */
  onDeselect?: () => void;
}

const PLACEHOLDER_FILL = "#e5e7eb";
const SELECT_COLOR = "#2563eb";

function resolveText(el: RenderableElement, sampleData?: Record<string, string>): string {
  if (el.content) return el.content;
  if (el.fieldKey) return sampleData?.[el.fieldKey] ?? `{{${el.fieldKey}}}`;
  return "";
}

function resolveImageSrc(el: RenderableElement, sampleData?: Record<string, string>): string | null {
  if (el.fieldKey) return sampleData?.[el.fieldKey] || null;
  return el.imageUrl || null;
}

/** A Rect + centered label, for placeholder-only element types (photo/qrcode/barcode) — same "just a box" fidelity the DOM renderer already had. */
function buildPlaceholder(label: string, widthPx: number, heightPx: number, fill = PLACEHOLDER_FILL): Group {
  const rect = new Rect({ left: 0, top: 0, width: widthPx, height: heightPx, fill });
  const text = new FabricText(label, {
    fontSize: Math.min(heightPx * 0.35, 11),
    fill: "#6b7280",
    originX: "center",
    originY: "center",
    left: widthPx / 2,
    top: heightPx / 2,
  });
  return new Group([rect, text], { subTargetCheck: false, interactive: false });
}

function buildBarcodePlaceholder(value: string, widthPx: number, heightPx: number): Group {
  const widths = encodeCode128B(value || "0000000");
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  const bars: FabricObject[] = [];
  let cursor = 0;
  for (const [i, w] of widths.entries()) {
    const barWidth = (w / total) * widthPx;
    if (i % 2 === 0) {
      bars.push(new Rect({ left: cursor, top: 0, width: barWidth, height: heightPx, fill: "#000000" }));
    }
    cursor += barWidth;
  }
  if (bars.length === 0) bars.push(new Rect({ left: 0, top: 0, width: widthPx, height: heightPx, fill: "#e5e7eb" }));
  return new Group(bars, { subTargetCheck: false, interactive: false });
}

/** Builds the Fabric object for one element. Async because image/logo elements load via FabricImage.fromURL. */
async function buildFabricObject(
  el: RenderableElement,
  ctx: { sampleData?: Record<string, string>; schoolLogoUrl?: string | null; barcodeValue?: string },
): Promise<FabricObject> {
  const widthPx = el.width * MM_TO_PX;
  const heightPx = el.height * MM_TO_PX;

  let obj: FabricObject;

  if (el.type === "shape") {
    obj = new Rect({ width: widthPx, height: heightPx, fill: el.backgroundColor ?? PLACEHOLDER_FILL });
  } else if (el.type === "photo") {
    obj = buildPlaceholder("PHOTO", widthPx, heightPx, el.backgroundColor || PLACEHOLDER_FILL);
  } else if (el.type === "qrcode") {
    obj = buildPlaceholder("QR", widthPx, heightPx);
  } else if (el.type === "barcode") {
    obj = buildBarcodePlaceholder(ctx.barcodeValue || ctx.sampleData?.[el.fieldKey ?? ""] || "", widthPx, heightPx);
  } else if (el.type === "image" || el.type === "logo") {
    const src = el.type === "image" ? resolveImageSrc(el, ctx.sampleData) : ctx.schoolLogoUrl;
    if (src) {
      const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
      img.scaleToWidth(widthPx);
      if (img.getScaledHeight() !== heightPx) img.scaleToHeight(heightPx);
      obj = img;
    } else {
      obj = buildPlaceholder(el.type === "logo" ? "LOGO" : "IMAGE", widthPx, heightPx);
    }
  } else if (el.type === "signature") {
    // A transparent full-box hit area plus a thin bottom bar, grouped — not
    // a Line, whose own x1/y1/x2/y2 don't track width/height/scaleX/scaleY
    // the way every other element type does, which would make its resize
    // handles behave inconsistently with the rest of the canvas.
    const hitArea = new Rect({ left: 0, top: 0, width: widthPx, height: heightPx, fill: "transparent" });
    const bar = new Rect({ left: 0, top: heightPx - 1, width: widthPx, height: 1, fill: "rgba(0,0,0,0.3)" });
    obj = new Group([hitArea, bar], { subTargetCheck: false, interactive: false });
  } else {
    // text | dynamic_field
    obj = new Textbox(resolveText(el, ctx.sampleData), {
      width: widthPx,
      height: heightPx,
      fontSize: (el.fontSize ?? 5) * MM_TO_PX,
      // Never pass an explicit `undefined` here: Fabric's constructor copies
      // every key present in the options object onto the instance (even
      // undefined ones), which clobbers its own class-level fontFamily
      // default and breaks internal font-cache lookups (getFontCache calls
      // .toLowerCase() on it) — the whole canvas silently fails to render.
      fontFamily: el.fontFamily || "Arial",
      fontWeight: el.fontWeight ?? "normal",
      textAlign: el.textAlign ?? "left",
      // Fabric's charSpacing is in 1/1000 em; el.letterSpacing/el.fontSize are
      // both in mm, so the mm unit cancels out — the ratio *is* the em value.
      charSpacing: el.letterSpacing && el.fontSize ? Math.round((el.letterSpacing / el.fontSize) * 1000) : undefined,
      lineHeight: el.lineHeight ?? 1.05,
      fill: el.color ?? "#111827",
      editable: false,
    });
  }

  if (el.borderWidth) {
    obj.set({
      stroke: el.borderColor ?? "#000000",
      strokeWidth: el.borderWidth * MM_TO_PX,
      strokeDashArray: el.borderStyle === "dashed" ? [el.borderWidth * MM_TO_PX * 2, el.borderWidth * MM_TO_PX] : undefined,
    });
  }

  obj.set({
    left: el.x * MM_TO_PX,
    top: el.y * MM_TO_PX,
    angle: el.rotation ?? 0,
    opacity: el.opacity ?? 1,
    lockScalingFlip: true,
    borderColor: SELECT_COLOR,
    cornerColor: SELECT_COLOR,
    cornerStyle: "circle",
    transparentCorners: false,
    cornerSize: 10,
  });
  obj.set("data", { id: el.id, elementType: el.type });

  return obj;
}

/** Bakes any accumulated scaleX/scaleY into width/height so stored size never compounds across repeated resizes. */
function commitScale(obj: FabricObject) {
  const w = obj.getScaledWidth();
  const h = obj.getScaledHeight();
  obj.set({ width: w, height: h, scaleX: 1, scaleY: 1 });
}

export function FabricDesignCanvas({
  pageWidthMm,
  pageHeightMm,
  cornerRadiusMm,
  elements,
  side = "front",
  sampleData,
  scale = 1,
  className,
  selectedElementId,
  schoolLogoUrl,
  backgroundImageUrl,
  barcodeValue,
  onElementClick,
  onElementTransform,
  onElementDelete,
  onDeselect,
}: FabricDesignCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const callbacksRef = useRef({ onElementClick, onElementTransform, onElementDelete, onDeselect });
  // Kept in a ref so the mount effect's closures always see the latest
  // elements without needing to be in that effect's dependency array.
  const elementsRef = useRef(elements);
  // Kept current after every render (not during it) — the mount effect's
  // closures read through these refs rather than depending on the values
  // directly, since re-subscribing Fabric's event listeners on every render
  // isn't necessary just because a parent re-created a callback prop.
  useEffect(() => {
    callbacksRef.current = { onElementClick, onElementTransform, onElementDelete, onDeselect };
    elementsRef.current = elements;
  });

  const widthPx = pageWidthMm * MM_TO_PX;
  const heightPx = pageHeightMm * MM_TO_PX;

  // Mount once. Re-created only if the page's physical size changes (a
  // different template), not on every element/zoom change.
  useEffect(() => {
    if (!canvasElRef.current) return;
    const canvas = new Canvas(canvasElRef.current, {
      width: widthPx,
      height: heightPx,
      selection: true,
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;

    function commit(target: FabricObject) {
      const { onElementTransform } = callbacksRef.current;
      if (!onElementTransform) return;

      if (target instanceof ActiveSelection) {
        // A multi-select drag/resize commits as one ActiveSelection — each
        // child object's own left/top/angle are already restored to
        // canvas-absolute coordinates by Fabric once the gesture ends, so
        // each is read and committed independently.
        for (const child of target.getObjects()) {
          commitOne(child);
        }
        return;
      }
      commitOne(target);

      function commitOne(obj: FabricObject) {
        const data = obj.get("data") as { id?: string } | undefined;
        if (!data?.id) return;
        commitScale(obj);
        callbacksRef.current.onElementTransform?.(data.id, {
          x: Math.max(0, obj.left! / MM_TO_PX),
          y: Math.max(0, obj.top! / MM_TO_PX),
          width: Math.max(3, obj.width! / MM_TO_PX),
          height: Math.max(3, obj.height! / MM_TO_PX),
          rotation: Math.round((obj.angle ?? 0) * 100) / 100,
        });
      }
    }

    canvas.on("object:modified", (e: ModifiedEvent) => e.target && commit(e.target));

    function selectFrom(e: { selected?: FabricObject[] }) {
      const obj = e.selected?.[0];
      const data = obj?.get("data") as { id?: string } | undefined;
      if (obj && data?.id && elementsRef.current) {
        const el = elementsRef.current.find((x) => x.id === data.id);
        if (el) callbacksRef.current.onElementClick?.(el);
      }
    }
    canvas.on("selection:created", selectFrom);
    canvas.on("selection:updated", selectFrom);
    canvas.on("selection:cleared", () => callbacksRef.current.onDeselect?.());

    // Snap the moving object's edges/center to the page's edges/center and
    // to sibling objects' edges, within a small tolerance — the one thing
    // Fabric doesn't give for free.
    const SNAP_PX = 5;
    canvas.on("object:moving", (e: BasicTransformEvent<TPointerEvent> & { target: FabricObject }) => {
      const target = e.target as FabricObject | undefined;
      if (!target || target instanceof ActiveSelection) return;
      const targets = [
        { x: 0, y: 0 },
        { x: widthPx / 2, y: heightPx / 2 },
        { x: widthPx, y: heightPx },
        ...canvas
          .getObjects()
          .filter((o) => o !== target)
          .map((o) => ({ x: o.left ?? 0, y: o.top ?? 0 })),
      ];
      for (const t of targets) {
        if (Math.abs((target.left ?? 0) - t.x) < SNAP_PX) target.set({ left: t.x });
        if (Math.abs((target.top ?? 0) - t.y) < SNAP_PX) target.set({ top: t.y });
      }
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const active = canvas.getActiveObject();
      if (!active || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const targets = active instanceof ActiveSelection ? active.getObjects() : [active];
      for (const obj of targets) {
        const data = obj.get("data") as { id?: string } | undefined;
        if (data?.id) callbacksRef.current.onElementDelete?.(data.id);
      }
      canvas.discardActiveObject();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [widthPx, heightPx]);

  // Rebuild every Fabric object whenever the element list (or side/sample
  // data/background) changes. Safe to do wholesale: every transform commits
  // only on pointer-release, so by the time a new `elements` array reaches
  // this component the in-progress gesture that produced it is already over.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let cancelled = false;

    async function rebuild() {
      const sideElements = elements.filter((el) => el.side === side).sort((a, b) => a.zIndex - b.zIndex);
      const built = await Promise.all(
        sideElements.map((el) => buildFabricObject(el, { sampleData, schoolLogoUrl, barcodeValue })),
      );
      if (cancelled) return;

      canvas!.clear();
      canvas!.backgroundColor = "#ffffff";
      for (const obj of built) canvas!.add(obj);

      if (selectedElementId) {
        const match = built.find((o) => (o.get("data") as { id?: string } | undefined)?.id === selectedElementId);
        if (match) canvas!.setActiveObject(match);
      }
      canvas!.requestRenderAll();
    }
    rebuild();

    return () => {
      cancelled = true;
    };
  }, [elements, side, sampleData, schoolLogoUrl, backgroundImageUrl, barcodeValue, selectedElementId]);

  useEffect(() => {
    fabricRef.current?.setZoom(scale);
    fabricRef.current?.setDimensions({ width: widthPx * scale, height: heightPx * scale });
  }, [scale, widthPx, heightPx]);

  return (
    <div
      className={className}
      style={{
        border: "1px solid rgba(0,0,0,0.1)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        borderRadius: cornerRadiusMm ? `${cornerRadiusMm * MM_TO_PX * scale}px` : undefined,
        overflow: "hidden",
        backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        width: widthPx * scale,
        height: heightPx * scale,
        boxSizing: "content-box",
      }}
    >
      <canvas ref={canvasElRef} />
    </div>
  );
}
