"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Copy,
  ArrowLeft,
  Type,
  Image as ImageIcon,
  Minus,
  Trash2,
  Bold,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  Undo2,
  Redo2,
  BringToFront,
  SendToBack,
} from "lucide-react";
import { CertificateCanvasPreview, type RenderableElement } from "@/features/certificates/certificate-canvas-preview";
import { FabricDesignCanvas } from "@/features/design-canvas/fabric-design-canvas";
import { useDesignHistory } from "@/features/design-canvas/use-design-history";
import { CertificateTemplateGallery } from "@/features/certificates/certificate-template-gallery";
import { SAMPLE_CERTIFICATE_DATA } from "@/features/certificates/sample-certificate-data";
import { CERTIFICATE_FIELD_GROUPS } from "@/lib/certificates/resolve-fields";
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
  pageWidthMm: number;
  pageHeightMm: number;
  backgroundImageUrl: string | null;
  certificateType: { id: string; name: string };
  elements: RenderableElement[];
}

async function uploadFile(file: File, kind: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Upload failed");
  return body.url as string;
}

/** The full PATCH-able field set for one element — the single source both the properties panel's save and undo/redo's reconciliation build from. */
function elementPatchPayload(el: RenderableElement): Record<string, unknown> {
  return {
    content: el.content ?? undefined,
    fieldKey: el.fieldKey ?? null,
    imageUrl: el.imageUrl ?? null,
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
    borderWidth: el.borderWidth ?? null,
    borderColor: el.borderColor ?? null,
    borderStyle: el.borderStyle ?? undefined,
    opacity: el.opacity ?? undefined,
    zIndex: el.zIndex,
  };
}

function DesignerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = searchParams.get("templateId");
  const focusTypeId = searchParams.get("certificateTypeId");

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [addingType, setAddingType] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const bgFileInput = useRef<HTMLInputElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  function load() {
    if (!templateId) return;
    setError(false);
    fetch(`/api/certificate-templates/${templateId}`)
      .then((r) => r.json())
      .then(setTemplate)
      .catch(() => setError(true));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // mm -> CSS px at 96dpi, matching how the browser rasterizes the canvas's `mm` units.
  const MM_TO_PX = 3.7795;

  function fitToScreen(pageWidthMm: number, pageHeightMm: number) {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const availableWidth = el.clientWidth - 40;
    const availableHeight = el.clientHeight - 40;
    const fit = Math.min(availableWidth / (pageWidthMm * MM_TO_PX), availableHeight / (pageHeightMm * MM_TO_PX));
    setZoom(Math.max(0.2, Math.min(1.5, Math.round(fit * 100) / 100)));
  }

  useEffect(() => {
    if (template) fitToScreen(template.pageWidthMm, template.pageHeightMm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  function zoomIn() {
    setZoom((z) => Math.min(2, Math.round((z + 0.1) * 100) / 100));
  }
  function zoomOut() {
    setZoom((z) => Math.max(0.2, Math.round((z - 0.1) * 100) / 100));
  }

  async function saveElement(elementId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/certificate-design-elements/${elementId}`, {
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
    imageUrl?: string | null;
  }) {
    if (!templateId) return null;
    const res = await fetch("/api/certificate-design-elements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, side: input.side ?? "front", type: input.type, x: input.x, y: input.y, width: input.width, height: input.height, content: input.content ?? undefined, fieldKey: input.fieldKey ?? undefined, imageUrl: input.imageUrl ?? undefined }),
    });
    const created = await res.json();
    if (!res.ok) throw new Error(created.error);
    // A fresh element only has creation-time fields — restore the rest (style, rotation, etc.) from the snapshot in one follow-up PATCH.
    const full = await saveElement(created.id, elementPatchPayload({ ...input, id: created.id } as RenderableElement)).catch(() => created);
    setTemplate((prev) => (prev ? { ...prev, elements: [...prev.elements.filter((e) => e.id !== full.id), full] } : prev));
    return full;
  }

  /**
   * Restores the element list to a prior snapshot — added elements are
   * removed, removed elements are re-created (with a new id; nothing in this
   * session pins to the old one), and elements present in both are patched
   * back to the snapshot's field values.
   */
  async function reconcileElements(target: RenderableElement[]) {
    if (!template) return;
    const current = template.elements;
    const targetById = new Map(target.filter((e) => e.id).map((e) => [e.id!, e]));
    const currentById = new Map(current.filter((e) => e.id).map((e) => [e.id!, e]));

    await Promise.all([
      ...current.filter((e) => e.id && !targetById.has(e.id)).map((e) => fetch(`/api/certificate-design-elements/${e.id}`, { method: "DELETE" }).catch(() => {})),
      ...target
        .filter((e) => e.id && currentById.has(e.id!))
        .map((e) => saveElement(e.id!, elementPatchPayload(e)).catch(() => {})),
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

  async function addElement(type: "text" | "image" | "line") {
    if (!templateId) return;
    setAddingType(type);
    snapshotElements();
    try {
      const created = await createElement({
        type,
        x: 40,
        y: 40,
        width: type === "line" ? 60 : 50,
        height: type === "line" ? 0.5 : type === "image" ? 25 : 8,
        content: type === "text" ? "New text" : undefined,
      });
      if (created) setSelectedId(created.id ?? null);
    } catch {
      toast({ title: "Couldn't add the element", variant: "danger" });
    } finally {
      setAddingType(null);
    }
  }

  async function deleteElement(elementId: string) {
    snapshotElements();
    try {
      const res = await fetch(`/api/certificate-design-elements/${elementId}`, { method: "DELETE" });
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

  async function updateTemplate(patch: Record<string, unknown>) {
    if (!templateId) return;
    const res = await fetch(`/api/certificate-templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    setTemplate(body);
  }

  async function handleBackgroundFile(file: File) {
    setUploadingBg(true);
    try {
      const url = await uploadFile(file, "certificate_background");
      await updateTemplate({ backgroundImageUrl: url });
      toast({ title: "Background updated", variant: "success" });
    } catch {
      toast({ title: "Couldn't upload the background image", variant: "danger" });
    } finally {
      setUploadingBg(false);
    }
  }

  async function duplicateTemplate() {
    if (!templateId) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/certificate-templates/${templateId}/duplicate`, { method: "POST" });
      const created = await res.json();
      if (!res.ok) throw new Error();
      toast({ title: "Saved as a school template", description: created.name, variant: "success" });
      router.replace(`/certificates/designer?templateId=${created.id}`);
    } catch {
      toast({ title: "Couldn't duplicate template", variant: "danger" });
    } finally {
      setDuplicating(false);
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

  if (!templateId) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div>
          {focusTypeId && (
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push("/certificates/designer")}>
              <ArrowLeft className="size-4" /> All designs
            </Button>
          )}
          <h1 className="mt-1 text-xl font-semibold text-foreground">Certificate Designer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the design each certificate type uses, then edit it. The design marked <strong>Fixed</strong> is what generation and printed PDFs use.
          </p>
        </div>
        <CertificateTemplateGallery
          selectedId={null}
          filterTypeId={focusTypeId}
          onSelect={(id) => router.push(`/certificates/designer?templateId=${id}`)}
        />
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
          <Button variant="ghost" size="sm" onClick={() => router.push("/certificates/designer")}>
            <ArrowLeft className="size-4" /> All designs
          </Button>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{template.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {template.certificateType.name} · {template.pageWidthMm} × {template.pageHeightMm} mm
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

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frame / background</p>
          {template.backgroundImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={template.backgroundImageUrl} alt="" className="h-10 w-auto rounded border border-border" />
          ) : (
            <span className="text-xs text-muted-foreground">None set — plain white page</span>
          )}
          <input
            ref={bgFileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleBackgroundFile(e.target.files[0])}
          />
          <Button variant="secondary" size="sm" onClick={() => bgFileInput.current?.click()} isLoading={uploadingBg}>
            <Upload className="size-4" /> {template.backgroundImageUrl ? "Replace" : "Upload"}
          </Button>
          {template.backgroundImageUrl && (
            <Button variant="ghost" size="sm" onClick={() => updateTemplate({ backgroundImageUrl: null })}>
              <X className="size-4" /> Remove
            </Button>
          )}

          <div className="mx-2 h-6 w-px bg-border" />

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add</p>
          <Button variant="secondary" size="sm" onClick={() => addElement("text")} isLoading={addingType === "text"}>
            <Type className="size-4" /> Text
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement("image")} isLoading={addingType === "image"}>
            <ImageIcon className="size-4" /> Image
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addElement("line")} isLoading={addingType === "line"}>
            <Minus className="size-4" /> Line
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 self-start rounded-md border border-border bg-surface p-1">
            <Button variant="ghost" size="icon" onClick={zoomOut} title="Zoom out">
              <ZoomOut className="size-4" />
            </Button>
            <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={zoomIn} title="Zoom in">
              <ZoomIn className="size-4" />
            </Button>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={() => fitToScreen(template.pageWidthMm, template.pageHeightMm)} title="Fit to screen">
              <Maximize className="size-4" /> Fit
            </Button>
            {!readOnly && (
              <>
                <div className="mx-1 h-5 w-px bg-border" />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!history.canUndo}
                  onClick={() => history.undo(template.elements)}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!history.canRedo}
                  onClick={() => history.redo(template.elements)}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 className="size-4" />
                </Button>
              </>
            )}
          </div>

          <div ref={canvasWrapperRef} className="flex h-[70vh] items-center justify-center overflow-auto rounded-lg border border-border bg-background p-10">
            {readOnly ? (
              <CertificateCanvasPreview
                pageWidthMm={template.pageWidthMm}
                pageHeightMm={template.pageHeightMm}
                elements={template.elements}
                sampleData={SAMPLE_CERTIFICATE_DATA}
                backgroundImageUrl={template.backgroundImageUrl}
                schoolLogoUrl={SAMPLE_CERTIFICATE_DATA["school.logoUrl"]}
                scale={zoom}
              />
            ) : (
              <FabricDesignCanvas
                pageWidthMm={template.pageWidthMm}
                pageHeightMm={template.pageHeightMm}
                elements={template.elements}
                sampleData={SAMPLE_CERTIFICATE_DATA}
                backgroundImageUrl={template.backgroundImageUrl}
                schoolLogoUrl={SAMPLE_CERTIFICATE_DATA["school.logoUrl"]}
                scale={zoom}
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
            <>
              <p className="text-sm text-muted-foreground">Click an element on the certificate to edit it, or add a new one above.</p>
              <FieldCodeReference />
            </>
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

/** Read-only reference of every `{{fieldKey}}` a template can bind to — shown when nothing is selected; the same list drives the field-binding dropdown once an element is selected. */
function FieldCodeReference() {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Available field codes</p>
      {CERTIFICATE_FIELD_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="text-xs font-medium text-foreground">{group.label}</p>
          <div className="flex flex-wrap gap-1">
            {group.fields.map((f) => (
              <code key={f.key} className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] text-muted-foreground dark:bg-white/10" title={f.label}>
                {`{{${f.key}}}`}
              </code>
            ))}
          </div>
        </div>
      ))}
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
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgFileInput = useRef<HTMLInputElement>(null);

  const isTextLike = draft.type === "text" || draft.type === "dynamic_field";
  const canBind = draft.type === "dynamic_field" || draft.type === "image";
  const canBorder = draft.type === "shape" || draft.type === "line" || draft.type === "image" || draft.type === "photo";

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

  async function handleImageUpload(file: File) {
    setUploadingImg(true);
    try {
      const url = await uploadFile(file, "certificate_background");
      setDraft((d) => ({ ...d, imageUrl: url, fieldKey: null }));
    } catch {
      toast({ title: "Couldn't upload image", variant: "danger" });
    } finally {
      setUploadingImg(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {draft.type}
          {draft.fieldKey && <span className="text-muted-foreground"> · {`{{${draft.fieldKey}}}`}</span>}
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
      <p className="text-[11px] text-muted-foreground">Or drag, resize, and rotate the element directly on the certificate.</p>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Label className="text-xs">Layer</Label>
        <Button variant="secondary" size="sm" onClick={() => draft.id && onReorder(draft.id, "front")}>
          <BringToFront className="size-4" /> Bring to front
        </Button>
        <Button variant="secondary" size="sm" onClick={() => draft.id && onReorder(draft.id, "back")}>
          <SendToBack className="size-4" /> Send to back
        </Button>
      </div>

      {isTextLike && (
        <>
          {draft.type === "text" && (
            <div className="flex flex-col gap-1">
              <Label>Text</Label>
              <Input value={draft.content ?? ""} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <NumberField label="Font size (mm)" value={draft.fontSize ?? 5} onChange={(v) => setDraft({ ...draft, fontSize: v })} step={0.5} />
            <Button
              type="button"
              variant={draft.fontWeight === "bold" ? "primary" : "secondary"}
              size="icon"
              className="mt-5"
              title="Bold"
              onClick={() => setDraft({ ...draft, fontWeight: draft.fontWeight === "bold" ? "normal" : "bold" })}
            >
              <Bold className="size-4" />
            </Button>
          </div>
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
            <Label>Color</Label>
            <Input type="color" value={draft.color ?? "#111827"} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-9 w-full p-1" />
          </div>
        </>
      )}

      {(draft.type === "shape" || draft.type === "photo") && (
        <div className="flex flex-col gap-1">
          <Label>Background color</Label>
          <Input type="color" value={draft.backgroundColor ?? "#e5e7eb"} onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value })} className="h-9 w-full p-1" />
        </div>
      )}

      {draft.type === "image" && (
        <div className="flex flex-col gap-2">
          <Label>Image</Label>
          <input
            ref={imgFileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
          />
          <Button variant="secondary" size="sm" onClick={() => imgFileInput.current?.click()} isLoading={uploadingImg} disabled={Boolean(draft.fieldKey)}>
            <Upload className="size-4" /> Upload image
          </Button>
          {draft.fieldKey && <p className="text-[11px] text-muted-foreground">Bound to a field below — clear the binding to upload a fixed image instead.</p>}
        </div>
      )}

      {canBind && (
        <div className="flex flex-col gap-1">
          <Label>Bind to school/student/staff data</Label>
          <Select value={draft.fieldKey ?? "none"} onValueChange={(v) => setDraft({ ...draft, fieldKey: v === "none" ? null : v })}>
            <SelectTrigger>
              <SelectValue placeholder="Fixed value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{draft.type === "image" ? "Fixed uploaded image" : "Fixed text"}</SelectItem>
              {CERTIFICATE_FIELD_GROUPS.map((group) => (
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
            Binding to <code>school.principalName</code>, <code>school.logoUrl</code>, etc. keeps this element in sync with School Profile automatically.
          </p>
        </div>
      )}

      {canBorder && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frame / border</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width (mm)" value={draft.borderWidth ?? 0} onChange={(v) => setDraft({ ...draft, borderWidth: v || null })} step={0.1} />
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Style</Label>
              <Select value={draft.borderStyle ?? "solid"} onValueChange={(v) => setDraft({ ...draft, borderStyle: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="dashed">Dashed</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Input type="color" value={draft.borderColor ?? "#000000"} onChange={(e) => setDraft({ ...draft, borderColor: e.target.value })} className="h-9 w-full p-1" />
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <Label className="text-xs">Opacity</Label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={draft.opacity ?? 1}
          onChange={(e) => setDraft({ ...draft, opacity: Number(e.target.value) })}
        />
      </div>

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
