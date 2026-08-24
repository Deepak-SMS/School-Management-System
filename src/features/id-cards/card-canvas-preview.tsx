import { QrCode, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RenderableElement {
  id?: string;
  side: string;
  type: string;
  fieldKey?: string | null;
  content?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number | null;
  fontSize?: number | null;
  fontWeight?: string | null;
  textAlign?: string | null;
  color?: string | null;
  backgroundColor?: string | null;
  zIndex: number;
}

interface CardCanvasPreviewProps {
  cardWidthMm: number;
  cardHeightMm: number;
  cornerRadiusMm?: number;
  elements: RenderableElement[];
  side: "front" | "back";
  /** Resolved values keyed by fieldKey, e.g. {"student.name": "Aarav Sharma"}. Falls back to the raw `{{fieldKey}}` token when missing. */
  sampleData?: Record<string, string>;
  /** Scales the whole card down for thumbnails; 1 = true physical size on screen. */
  scale?: number;
  className?: string;
  /** When provided, elements become clickable (used by the Designer to select an element to edit). */
  onElementClick?: (element: RenderableElement) => void;
  selectedElementId?: string;
}

function resolveText(el: RenderableElement, sampleData?: Record<string, string>): string {
  if (el.content) return el.content;
  if (el.fieldKey) return sampleData?.[el.fieldKey] ?? `{{${el.fieldKey}}}`;
  return "";
}

export function CardCanvasPreview({
  cardWidthMm,
  cardHeightMm,
  cornerRadiusMm = 3.18,
  elements,
  side,
  sampleData,
  scale = 1,
  className,
  onElementClick,
  selectedElementId,
}: CardCanvasPreviewProps) {
  const sideElements = elements.filter((el) => el.side === side).sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      className={cn("overflow-hidden", className)}
      style={{ width: `${cardWidthMm * scale}mm`, height: `${cardHeightMm * scale}mm` }}
    >
      <div
        className="relative overflow-hidden border border-black/10 bg-white shadow-sm"
        style={{
          width: `${cardWidthMm}mm`,
          height: `${cardHeightMm}mm`,
          borderRadius: `${cornerRadiusMm}mm`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
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
          };
          const onClick = onElementClick ? () => onElementClick(el) : undefined;

          if (el.type === "shape") {
            return <div key={key} onClick={onClick} style={{ ...baseStyle, backgroundColor: el.backgroundColor ?? "#e5e7eb" }} />;
          }

          if (el.type === "photo") {
            return (
              <div
                key={key}
                onClick={onClick}
                style={{ ...baseStyle, backgroundColor: el.backgroundColor || "#e5e7eb" }}
                className="flex items-center justify-center"
              >
                <User className="h-1/2 w-1/2 text-black/25" />
              </div>
            );
          }

          if (el.type === "logo") {
            return (
              <div key={key} onClick={onClick} style={baseStyle} className="flex items-center justify-center rounded bg-black/5 text-[6px] font-medium text-black/40">
                LOGO
              </div>
            );
          }

          if (el.type === "signature") {
            return (
              <div key={key} onClick={onClick} style={baseStyle} className="border-b border-black/30" />
            );
          }

          if (el.type === "qrcode" || el.type === "barcode") {
            return (
              <div key={key} onClick={onClick} style={baseStyle} className="flex items-center justify-center bg-black/5">
                <QrCode className="h-4/5 w-4/5 text-black/70" strokeWidth={1} />
              </div>
            );
          }

          // text | dynamic_field
          return (
            <div
              key={key}
              onClick={onClick}
              style={{
                ...baseStyle,
                fontSize: `${el.fontSize ?? 5}mm`,
                fontWeight: el.fontWeight ?? "normal",
                textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left",
                color: el.color ?? "#111827",
                lineHeight: 1.05,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {resolveText(el, sampleData)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
