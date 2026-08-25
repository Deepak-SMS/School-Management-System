"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { CardCanvasPreview } from "@/features/id-cards/card-canvas-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

interface PreviewElement {
  id: string;
  side: string;
  type: string;
  fieldKey?: string | null;
  content?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize?: number | null;
  fontFamily?: string | null;
  fontWeight?: string | null;
  textAlign?: string | null;
  color?: string | null;
  backgroundColor?: string | null;
  zIndex: number;
}

interface PreviewData {
  person: { id: string; type: string; name: string; reference: string; photoUrl?: string | null };
  template: { id: string; name: string; cardWidthMm: number; cardHeightMm: number; cornerRadiusMm: number };
  elements: PreviewElement[];
  fields: Record<string, string>;
  schoolLogoUrl?: string | null;
  verificationCode?: string | null;
  barcodeValue?: string;
  card: { id: string; status: string; cardNumber?: string | null; issuedAt?: string | null } | null;
}

/**
 * Shows one person's ID card, front and back.
 *
 * The values are resolved server-side by the same functions PDF generation uses,
 * so what appears here is what would print — not a mock-up. A person without a
 * card yet previews against the template their card would use.
 */
export function CardPreviewModal({
  personType,
  personId,
  onClose,
}: {
  personType: string;
  personId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<"front" | "back">("front");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/id-cards/people/${personType}/${personId}/preview`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body as PreviewData;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((e) => {
        if (!cancelled) setError((e as ApiError)?.error ?? "Couldn't load this card.");
      });
    return () => {
      cancelled = true;
    };
  }, [personType, personId]);

  const hasBack = data?.elements.some((el) => el.side === "back") ?? false;

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title={data ? `${data.person.name} — ID card` : "ID card"}
        description={data ? `${data.person.reference} · template: ${data.template.name}` : undefined}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}
          {!data && !error && <LoadingState label="Rendering card…" />}

          {data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {data.card ? (
                  <Badge variant={data.card.status === "active" ? "success" : "neutral"}>
                    {data.card.status}
                    {data.card.cardNumber ? ` · ${data.card.cardNumber}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="warning">Not generated yet</Badge>
                )}

                {hasBack && (
                  <div className="ml-auto flex gap-1">
                    <SideButton active={side === "front"} onClick={() => setSide("front")}>
                      Front
                    </SideButton>
                    <SideButton active={side === "back"} onClick={() => setSide("back")}>
                      Back
                    </SideButton>
                  </div>
                )}
              </div>

              {/* Centred on a neutral ground so the card reads as a physical object. */}
              <div className="flex justify-center rounded-lg bg-black/[0.04] p-6 dark:bg-white/[0.04]">
                <div className="shadow-lg">
                  <CardCanvasPreview
                    cardWidthMm={data.template.cardWidthMm}
                    cardHeightMm={data.template.cardHeightMm}
                    cornerRadiusMm={data.template.cornerRadiusMm}
                    elements={data.elements as never}
                    side={side}
                    sampleData={data.fields}
                    scale={1.4}
                    schoolLogoUrl={data.schoolLogoUrl}
                    barcodeValue={data.barcodeValue}
                  />
                </div>
              </div>

              {data.verificationCode && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="size-4 shrink-0 text-accent-600" aria-hidden="true" />
                  Verification code <span className="font-mono text-foreground">VERIFY-{data.verificationCode}</span>
                </p>
              )}

              {!data.card && (
                <Alert variant="info">
                  This is how the card will look once generated. Use{" "}
                  <strong>Generate Cards</strong> to issue it.
                </Alert>
              )}
            </>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function SideButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary-600 bg-primary-50 text-primary-700"
          : "border-border-strong text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
