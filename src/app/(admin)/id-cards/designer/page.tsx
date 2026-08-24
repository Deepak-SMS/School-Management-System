"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Copy } from "lucide-react";
import { CardCanvasPreview, type RenderableElement } from "@/features/id-cards/card-canvas-preview";
import { SAMPLE_CARD_DATA } from "@/features/id-cards/sample-card-data";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";

interface TemplateDetail {
  id: string;
  name: string;
  isSystemTemplate: boolean;
  orientation: string;
  cardWidthMm: number;
  cardHeightMm: number;
  cornerRadiusMm: number;
  elements: RenderableElement[];
}

function DesignerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = searchParams.get("templateId");

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState(false);
  const [side, setSide] = useState<"front" | "back">("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  function load() {
    if (!templateId) return;
    setError(false);
    fetch(`/api/id-card-templates/${templateId}`)
      .then((r) => r.json())
      .then(setTemplate)
      .catch(() => setError(true));
  }

  useEffect(() => {
    if (!templateId) return;
    fetch(`/api/id-card-templates/${templateId}`)
      .then((r) => r.json())
      .then(setTemplate)
      .catch(() => setError(true));
  }, [templateId]);

  async function saveElement(elementId: string, patch: Partial<RenderableElement>) {
    const res = await fetch(`/api/design-elements/${elementId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: patch.content ?? undefined,
        x: patch.x,
        y: patch.y,
        width: patch.width,
        height: patch.height,
        fontSize: patch.fontSize ?? undefined,
        fontWeight: patch.fontWeight ?? undefined,
        textAlign: patch.textAlign ?? undefined,
        color: patch.color ?? undefined,
        backgroundColor: patch.backgroundColor ?? undefined,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    setTemplate((prev) => (prev ? { ...prev, elements: prev.elements.map((e) => (e.id === body.id ? body : e)) } : prev));
    return body;
  }

  async function duplicateTemplate() {
    if (!templateId) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/id-card-templates/${templateId}/duplicate`, { method: "POST" });
      const created = await res.json();
      if (!res.ok) throw new Error();
      toast({ title: "Saved as a school template", description: created.name, variant: "success" });
      router.replace(`/id-cards/designer?templateId=${created.id}`);
    } catch {
      toast({ title: "Couldn't duplicate template", variant: "danger" });
    } finally {
      setDuplicating(false);
    }
  }

  if (!templateId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState title="No template selected" description="Open a template from the Templates gallery to design it." />
      </div>
    );
  }

  if (error) return <ErrorState className="mx-auto max-w-6xl px-6 py-16" onRetry={load} />;
  if (!template) return <LoadingState className="mx-auto max-w-6xl px-6 py-16" />;

  const sideElements = template.elements.filter((e) => e.side === side);
  const readOnly = template.isSystemTemplate;
  const selectedElement = template.elements.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{template.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {template.cardWidthMm} × {template.cardHeightMm} mm · {template.orientation}
          </p>
        </div>
        {readOnly && (
          <Button onClick={duplicateTemplate} isLoading={duplicating}>
            <Copy className="size-4" /> Save as school template
          </Button>
        )}
      </div>

      {readOnly && (
        <Alert variant="info" title="System template — read only">
          This is a shared starting point. Click &quot;Save as school template&quot; to make an editable copy.
        </Alert>
      )}

      <Tabs value={side} onValueChange={(v) => setSide(v as "front" | "back")}>
        <TabsList>
          <TabsTrigger value="front">Front</TabsTrigger>
          <TabsTrigger value="back">Back</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="flex items-center justify-center rounded-lg border border-border bg-background p-10">
          <CardCanvasPreview
            cardWidthMm={template.cardWidthMm}
            cardHeightMm={template.cardHeightMm}
            cornerRadiusMm={template.cornerRadiusMm}
            elements={sideElements}
            side={side}
            sampleData={SAMPLE_CARD_DATA}
            scale={3}
            onElementClick={readOnly ? undefined : (el) => setSelectedId(el.id ?? null)}
            selectedElementId={selectedId ?? undefined}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {readOnly ? (
              <span className="flex items-center gap-1">
                <Lock className="size-3" /> Read only
              </span>
            ) : (
              "Properties"
            )}
          </p>
          {!selectedElement && <p className="text-sm text-muted-foreground">Click an element on the card to edit it.</p>}
          {selectedElement && !readOnly && (
            <ElementPropertiesPanel key={selectedElement.id} element={selectedElement} onSave={saveElement} />
          )}
        </div>
      </div>
    </div>
  );
}

function ElementPropertiesPanel({
  element,
  onSave,
}: {
  element: RenderableElement;
  onSave: (elementId: string, patch: Partial<RenderableElement>) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(element);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft.id) return;
    setSaving(true);
    try {
      await onSave(draft.id, draft);
      toast({ title: "Element updated", variant: "success" });
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : undefined, variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground">
        {draft.type}
        {draft.fieldKey && <span className="text-muted-foreground"> · {draft.fieldKey}</span>}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X (mm)" value={draft.x} onChange={(v) => setDraft({ ...draft, x: v })} />
        <NumberField label="Y (mm)" value={draft.y} onChange={(v) => setDraft({ ...draft, y: v })} />
        <NumberField label="Width (mm)" value={draft.width} onChange={(v) => setDraft({ ...draft, width: v })} />
        <NumberField label="Height (mm)" value={draft.height} onChange={(v) => setDraft({ ...draft, height: v })} />
      </div>
      {(draft.type === "text" || draft.type === "dynamic_field") && (
        <>
          {draft.type === "text" && (
            <div className="flex flex-col gap-1">
              <Label>Text</Label>
              <Input value={draft.content ?? ""} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            </div>
          )}
          <NumberField label="Font size (mm)" value={draft.fontSize ?? 5} onChange={(v) => setDraft({ ...draft, fontSize: v })} step={0.5} />
          <div className="flex flex-col gap-1">
            <Label>Alignment</Label>
            <Select value={draft.textAlign ?? "left"} onValueChange={(v) => setDraft({ ...draft, textAlign: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Weight</Label>
            <Select value={draft.fontWeight ?? "normal"} onValueChange={(v) => setDraft({ ...draft, fontWeight: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Color</Label>
            <Input type="color" value={draft.color ?? "#111827"} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-9 w-full p-1" />
          </div>
        </>
      )}
      {(draft.type === "shape" || draft.type === "photo") && (
        <div className="flex flex-col gap-1">
          <Label>Background color</Label>
          <Input
            type="color"
            value={draft.backgroundColor ?? "#e5e7eb"}
            onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value })}
            className="h-9 w-full p-1"
          />
        </div>
      )}
      <Button size="sm" onClick={handleSave} isLoading={saving}>
        Save changes
      </Button>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 0.5 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export default function DesignerPage() {
  return (
    <Suspense>
      <DesignerInner />
    </Suspense>
  );
}
