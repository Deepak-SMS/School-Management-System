"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Copy,
  ArrowLeft,
  Undo2,
  Redo2,
  BringToFront,
  SendToBack,
  Trash2,
  Type,
  Braces,
  User,
  Image as ImageIcon,
  PenTool,
  QrCode,
  Barcode as BarcodeIcon,
  Square,
} from "lucide-react";
import { CardCanvasPreview, type RenderableElement } from "@/features/id-cards/card-canvas-preview";
import { FabricDesignCanvas } from "@/features/design-canvas/fabric-design-canvas";
import { useDesignHistory } from "@/features/design-canvas/use-design-history";
import { TemplateBrowser } from "@/features/id-cards/template-browser";
import { SAMPLE_CARD_DATA } from "@/features/id-cards/sample-card-data";
import { ID_CARD_FIELD_GROUPS } from "@/lib/id-cards/resolve-fields";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
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

/** The full PATCH-able field set for one element — mirrors src/app/(admin)/certificates/designer/page.tsx's elementPatchPayload. */
function elementPatchPayload(el: RenderableElement): Record<string, unknown> {
  return {
    fieldKey: el.fieldKey ?? null,
    content: el.content ?? undefined,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.rotation ?? 0,
    fontSize: el.fontSize ?? undefined,
    fontWeight: el.fontWeight ?? undefined,
    textAlign: el.textAlign ?? undefined,
    color: el.color ?? undefined,
    backgroundColor: el.backgroundColor ?? undefined,
    zIndex: el.zIndex,
  };
}

/** Default size (mm) for each quick-add element type, sized for an ID-card-scale canvas — all start at the same top-left position and are dragged into place, same simplicity the certificate designer's "Add" bar already uses. */
const ELEMENT_DEFAULTS: Record<string, { width: number; height: number }> = {
  text: { width: 30, height: 6 },
  dynamic_field: { width: 30, height: 6 },
  photo: { width: 18, height: 22 },
  logo: { width: 12, height: 12 },
  signature: { width: 22, height: 8 },
  qrcode: { width: 14, height: 14 },
  barcode: { width: 28, height: 8 },
  shape: { width: 20, height: 12 },
};

function DesignerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = searchParams.get("templateId");

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState(false);
  const [side, setSide] = useState<"front" | "back">("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [addingType, setAddingType] = useState<string | null>(null);

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

  async function saveElement(elementId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/design-elements/${elementId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    setTemplate((prev) => (prev ? { ...prev, elements: prev.elements.map((e) => (e.id === body.id ? body : e)) } : prev));
    return body as RenderableElement;
  }

  async function createElement(input: {
    side?: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string | null;
    fieldKey?: string | null;
  }) {
    if (!templateId) return null;
    const res = await fetch("/api/design-elements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        side: input.side ?? side,
        type: input.type,
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
        content: input.content ?? undefined,
        fieldKey: input.fieldKey ?? undefined,
      }),
    });
    const created = await res.json();
    if (!res.ok) throw new Error(created.error);
    // A fresh element only has creation-time fields — restore the rest (style, rotation, etc.) from the snapshot in one follow-up PATCH.
    const full = await saveElement(created.id, elementPatchPayload({ ...input, id: created.id } as RenderableElement)).catch(() => created);
    setTemplate((prev) => (prev ? { ...prev, elements: [...prev.elements.filter((e) => e.id !== full.id), full] } : prev));
    return full;
  }

  async function addElement(type: keyof typeof ELEMENT_DEFAULTS) {
    if (!templateId) return;
    setAddingType(type);
    snapshotElements();
    try {
      const { width, height } = ELEMENT_DEFAULTS[type];
      const created = await createElement({
        type,
        side,
        x: 5,
        y: 5,
        width,
        height,
        content: type === "text" ? "New text" : undefined,
        fieldKey: type === "dynamic_field" ? "student.name" : undefined,
      });
      if (created) setSelectedId(created.id ?? null);
    } catch {
      toast({ title: "Couldn't add the element", variant: "danger" });
    } finally {
      setAddingType(null);
    }
  }

  /**
   * Restores the element list to a prior snapshot — added elements are
   * removed, removed elements are re-created (with a new id; nothing in this
   * session pins to the old one), and elements present in both are patched
   * back to the snapshot's field values. Mirrors the certificate designer's
   * reconcileElements now that a create route exists here too.
   */
  async function reconcileElements(target: RenderableElement[]) {
    if (!template) return;
    const current = template.elements;
    const targetById = new Map(target.filter((e) => e.id).map((e) => [e.id!, e]));
    const currentById = new Map(current.filter((e) => e.id).map((e) => [e.id!, e]));

    await Promise.all([
      ...current.filter((e) => e.id && !targetById.has(e.id)).map((e) => fetch(`/api/design-elements/${e.id}`, { method: "DELETE" }).catch(() => {})),
      ...target.filter((e) => e.id && currentById.has(e.id!)).map((e) => saveElement(e.id!, elementPatchPayload(e)).catch(() => {})),
      ...target.filter((e) => e.id && !currentById.has(e.id!)).map((e) => createElement(e)),
    ]);

    load();
    setSelectedId(null);
  }

  const history = useDesignHistory<RenderableElement[]>((snapshot) => void reconcileElements(snapshot));

  function snapshotElements() {
    if (template) history.pushSnapshot(template.elements);
  }

  async function handleTransform(elementId: string, patch: { x?: number; y?: number; width?: number; height?: number; rotation?: number }) {
    snapshotElements();
    try {
      await saveElement(elementId, patch);
    } catch {
      toast({ title: "Couldn't move/resize the element", variant: "danger" });
    }
  }

  async function deleteElement(elementId: string) {
    snapshotElements();
    try {
      const res = await fetch(`/api/design-elements/${elementId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTemplate((prev) => (prev ? { ...prev, elements: prev.elements.filter((e) => e.id !== elementId) } : prev));
      setSelectedId(null);
    } catch {
      toast({ title: "Couldn't remove the element", variant: "danger" });
    }
  }

  async function reorderLayer(elementId: string, direction: "front" | "back") {
    if (!template) return;
    const zIndexes = template.elements.map((e) => e.zIndex);
    const target = direction === "front" ? Math.max(0, ...zIndexes) + 1 : Math.min(0, ...zIndexes) - 1;
    snapshotElements();
    try {
      await saveElement(elementId, { zIndex: target });
    } catch {
      toast({ title: "Couldn't reorder the element", variant: "danger" });
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      if (!template) return;
      if (e.shiftKey) history.redo(template.elements);
      else history.undo(template.elements);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

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
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        {/* No template chosen yet — the browser IS the landing state, so the
            designer is self-contained and there's no separate gallery page. */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">Card Designer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the design each kind of card uses, then edit it. The design marked <strong>Fixed</strong> is what
            previews and printed PDFs use.
          </p>
        </div>
        <TemplateBrowser selectedId={null} onSelect={(id) => router.push(`/id-cards/designer?templateId=${id}`)} />
      </div>
    );
  }

  if (error) return <ErrorState className="mx-auto max-w-6xl px-6 py-16" onRetry={load} />;
  if (!template) return <LoadingState className="mx-auto max-w-6xl px-6 py-16" />;

  const readOnly = template.isSystemTemplate;
  const selectedElement = template.elements.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/id-cards/designer")}>
            <ArrowLeft className="size-4" /> All designs
          </Button>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{template.name}</h1>
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

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add</p>
          <Button variant="secondary" size="sm" onClick={() => addElement("text")} isLoading={addingType === "text"}>
            <Type className="size-4" /> Text
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement("dynamic_field")} isLoading={addingType === "dynamic_field"}>
            <Braces className="size-4" /> Dynamic Field
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement("photo")} isLoading={addingType === "photo"}>
            <User className="size-4" /> Photo
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement("logo")} isLoading={addingType === "logo"}>
            <ImageIcon className="size-4" /> Logo
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement("signature")} isLoading={addingType === "signature"}>
            <PenTool className="size-4" /> Signature
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement("qrcode")} isLoading={addingType === "qrcode"}>
            <QrCode className="size-4" /> QR Code
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement("barcode")} isLoading={addingType === "barcode"}>
            <BarcodeIcon className="size-4" /> Barcode
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement("shape")} isLoading={addingType === "shape"}>
            <Square className="size-4" /> Shape
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-2">
          {!readOnly && (
            <div className="flex items-center gap-1 self-start rounded-md border border-border bg-surface p-1">
              <Button variant="ghost" size="icon" disabled={!history.canUndo} onClick={() => history.undo(template.elements)} title="Undo (Ctrl+Z)">
                <Undo2 className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" disabled={!history.canRedo} onClick={() => history.redo(template.elements)} title="Redo (Ctrl+Shift+Z)">
                <Redo2 className="size-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center justify-center rounded-lg border border-border bg-background p-10">
            {readOnly ? (
              <CardCanvasPreview
                cardWidthMm={template.cardWidthMm}
                cardHeightMm={template.cardHeightMm}
                cornerRadiusMm={template.cornerRadiusMm}
                elements={template.elements}
                side={side}
                sampleData={SAMPLE_CARD_DATA}
                scale={3}
              />
            ) : (
              <FabricDesignCanvas
                pageWidthMm={template.cardWidthMm}
                pageHeightMm={template.cardHeightMm}
                cornerRadiusMm={template.cornerRadiusMm}
                elements={template.elements}
                side={side}
                sampleData={SAMPLE_CARD_DATA}
                scale={3}
                selectedElementId={selectedId ?? undefined}
                onElementClick={(el) => setSelectedId(el.id ?? null)}
                onDeselect={() => setSelectedId(null)}
                onElementTransform={handleTransform}
                onElementDelete={deleteElement}
              />
            )}
          </div>
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
          {!selectedElement && (
            <p className="text-sm text-muted-foreground">
              {readOnly ? "Click an element on the card to edit it." : "Click an element on the card to edit it, or add a new one above."}
            </p>
          )}
          {selectedElement && !readOnly && (
            <ElementPropertiesPanel
              key={selectedElement.id}
              element={selectedElement}
              onSave={(id, patch) => {
                snapshotElements();
                return saveElement(id, patch);
              }}
              onDelete={deleteElement}
              onReorder={reorderLayer}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ElementPropertiesPanel({
  element,
  onSave,
  onDelete,
  onReorder,
}: {
  element: RenderableElement;
  onSave: (elementId: string, patch: Record<string, unknown>) => Promise<unknown>;
  onDelete: (elementId: string) => Promise<void>;
  onReorder: (elementId: string, direction: "front" | "back") => Promise<void>;
}) {
  const [draft, setDraft] = useState(element);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft.id) return;
    setSaving(true);
    try {
      await onSave(draft.id, elementPatchPayload(draft));
      toast({ title: "Element updated", variant: "success" });
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : undefined, variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {draft.type}
          {draft.fieldKey && <span className="text-muted-foreground"> · {draft.fieldKey}</span>}
        </p>
        <Button variant="ghost" size="sm" className="text-danger-600 hover:bg-danger-50 hover:text-danger-600" onClick={() => draft.id && onDelete(draft.id)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X (mm)" value={draft.x} onChange={(v) => setDraft({ ...draft, x: v })} />
        <NumberField label="Y (mm)" value={draft.y} onChange={(v) => setDraft({ ...draft, y: v })} />
        <NumberField label="Width (mm)" value={draft.width} onChange={(v) => setDraft({ ...draft, width: v })} />
        <NumberField label="Height (mm)" value={draft.height} onChange={(v) => setDraft({ ...draft, height: v })} />
        <NumberField label="Rotation (°)" value={draft.rotation ?? 0} onChange={(v) => setDraft({ ...draft, rotation: v })} step={1} />
      </div>
      <p className="text-[11px] text-muted-foreground">Or drag, resize, and rotate the element directly on the card.</p>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Label className="text-xs">Layer</Label>
        <Button variant="secondary" size="sm" onClick={() => draft.id && onReorder(draft.id, "front")}>
          <BringToFront className="size-4" /> Front
        </Button>
        <Button variant="secondary" size="sm" onClick={() => draft.id && onReorder(draft.id, "back")}>
          <SendToBack className="size-4" /> Back
        </Button>
      </div>

      {(draft.type === "text" || draft.type === "dynamic_field") && (
        <>
          {draft.type === "text" && (
            <div className="flex flex-col gap-1">
              <Label>Text</Label>
              <Input value={draft.content ?? ""} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            </div>
          )}
          {draft.type === "dynamic_field" && (
            <div className="flex flex-col gap-1">
              <Label>Data field</Label>
              <Select value={draft.fieldKey ?? ""} onValueChange={(v) => setDraft({ ...draft, fieldKey: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a field" />
                </SelectTrigger>
                <SelectContent>
                  {ID_CARD_FIELD_GROUPS.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.fields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Prints as this student/staff/school value on every generated card — the same field code prints on every card in this batch.
              </p>
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
