import { QrCode, User, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { encodeCode128B } from "@/lib/id-cards/code128";

/** Same shape as ID cards' RenderableElement — see src/features/id-cards/card-canvas-preview.tsx — plus the certificate-only image/border/opacity fields. */
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

interface CertificateCanvasPreviewProps {
  pageWidthMm: number;
  pageHeightMm: number;
  elements: RenderableElement[];
  /** Resolved values keyed by fieldKey, e.g. {"student.name": "Aarav Sharma"}. Falls back to the raw `{{fieldKey}}` token when missing. */
  sampleData?: Record<string, string>;
  /** Scales the whole page down for thumbnails; 1 = true physical size on screen. */
  scale?: number;
  className?: string;
  /** When provided, elements become clickable (used by galleries/preview modals to pick a template, not to edit one — see FabricDesignCanvas for the interactive editor). */
  onElementClick?: (element: RenderableElement) => void;
  selectedElementId?: string;
  schoolLogoUrl?: string | null;
  /** The "frame" — a full-page decorative background rendered behind every element. */
  backgroundImageUrl?: string | null;
  barcodeValue?: string;
}

function resolveText(el: RenderableElement, sampleData?: Record<string, string>): string {
  if (el.content) return el.content;
  if (el.fieldKey) return sampleData?.[el.fieldKey] ?? `{{${el.fieldKey}}}`;
  return "";
}

function resolveImageSrc(el: RenderableElement, sampleData?: Record<string, string>): string | null {
  if (el.fieldKey) return sampleData?.[el.fieldKey] || null;
  return el.imageUrl || null;
}

/**
 * Read-only certificate renderer — template galleries, preview modals, and
 * (for a system/read-only template) the designer's own display fall back to
 * this. Interactive editing lives in FabricDesignCanvas
 * (src/features/design-canvas/fabric-design-canvas.tsx); this component has
 * no drag/resize/rotate of its own.
 */
export function CertificateCanvasPreview({
  pageWidthMm,
  pageHeightMm,
  elements,
  sampleData,
  scale = 1,
  className,
  onElementClick,
  selectedElementId,
  schoolLogoUrl,
  backgroundImageUrl,
  barcodeValue,
}: CertificateCanvasPreviewProps) {
  const sideElements = elements.filter((el) => el.side === "front").sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className={cn("overflow-hidden", className)} style={{ width: `${pageWidthMm * scale}mm`, height: `${pageHeightMm * scale}mm` }}>
      <div
        className="relative overflow-hidden border border-black/10 bg-white shadow-sm"
        style={{
          width: `${pageWidthMm}mm`,
          height: `${pageHeightMm}mm`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {sideElements.map((el, i) => {
          const key = el.id ?? i;
          const isSelected = Boolean(el.id) && el.id === selectedElementId;

          const baseStyle: React.CSSProperties = {
            position: "absolute",
            left: `${el.x}mm`,
            top: `${el.y}mm`,
            width: `${el.width}mm`,
            height: `${el.height}mm`,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            cursor: onElementClick ? "pointer" : undefined,
            outline: isSelected ? "0.5mm solid #2563eb" : undefined,
            outlineOffset: "0.3mm",
            opacity: el.opacity ?? 1,
            ...(el.borderWidth
              ? { border: `${el.borderWidth}mm ${el.borderStyle ?? "solid"} ${el.borderColor ?? "#000000"}`, boxSizing: "border-box" as const }
              : undefined),
          };
          const onClick = onElementClick ? () => onElementClick(el) : undefined;

          let body: React.ReactNode;

          if (el.type === "shape") {
            body = <div style={{ ...baseStyle, backgroundColor: el.backgroundColor ?? "#e5e7eb" }} onClick={onClick} />;
          } else if (el.type === "photo") {
            body = (
              <div style={{ ...baseStyle, backgroundColor: el.backgroundColor || "#e5e7eb" }} className="flex items-center justify-center" onClick={onClick}>
                <User className="h-1/2 w-1/2 text-black/25" />
              </div>
            );
          } else if (el.type === "image" || el.type === "logo") {
            const src = el.type === "image" ? resolveImageSrc(el, sampleData) : schoolLogoUrl;
            body = src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" style={{ ...baseStyle, objectFit: "contain" }} onClick={onClick} />
            ) : (
              <div style={baseStyle} className="flex flex-col items-center justify-center gap-1 rounded bg-black/5 text-[6px] font-medium text-black/40" onClick={onClick}>
                <ImageOff className="size-3" /> {el.type === "logo" ? "LOGO" : "IMAGE"}
              </div>
            );
          } else if (el.type === "signature") {
            body = <div style={{ ...baseStyle, borderBottom: baseStyle.border ? undefined : "0.15mm solid rgba(0,0,0,0.3)" }} onClick={onClick} />;
          } else if (el.type === "qrcode") {
            body = (
              <div style={baseStyle} className="flex items-center justify-center bg-black/5" onClick={onClick}>
                <QrCode className="h-4/5 w-4/5 text-black/70" strokeWidth={1} />
              </div>
            );
          } else if (el.type === "barcode") {
            const widths = encodeCode128B(barcodeValue || sampleData?.[el.fieldKey ?? ""] || "0000000");
            const total = widths.reduce((a, b) => a + b, 0) || 1;
            body = (
              <div style={{ ...baseStyle, display: "flex" }} className="bg-white" onClick={onClick}>
                {widths.map((w, wi) => (
                  <div key={wi} style={{ flex: `${w} ${w} 0`, height: "100%", backgroundColor: wi % 2 === 0 ? "#000" : "transparent" }} />
                ))}
                {widths.length === 0 && <div className="h-full w-full bg-black/10" style={{ flex: total }} />}
              </div>
            );
          } else {
            // text | dynamic_field
            body = (
              <div
                style={{
                  ...baseStyle,
                  fontSize: `${el.fontSize ?? 5}mm`,
                  fontFamily: el.fontFamily || undefined,
                  fontWeight: el.fontWeight ?? "normal",
                  textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left",
                  letterSpacing: el.letterSpacing ? `${el.letterSpacing}mm` : undefined,
                  color: el.color ?? "#111827",
                  lineHeight: el.lineHeight ?? 1.05,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                onClick={onClick}
              >
                {resolveText(el, sampleData)}
              </div>
            );
          }

          return (
            <div key={key} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, zIndex: el.zIndex }}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
