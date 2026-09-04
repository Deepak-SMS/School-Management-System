"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Star, GraduationCap, UserCog, Plus } from "lucide-react";
import { CertificateCanvasPreview } from "@/features/certificates/certificate-canvas-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

interface CertificateTypeSummary {
  id: string;
  name: string;
  category: "student" | "staff";
}

interface TemplateSummary {
  id: string;
  name: string;
  isSystemTemplate: boolean;
  isDefault: boolean;
  isActive: boolean;
  pageWidthMm: number;
  pageHeightMm: number;
  certificateTypeId: string;
  certificateType: CertificateTypeSummary;
  elements?: {
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
    fontWeight?: string | null;
    textAlign?: string | null;
    color?: string | null;
    backgroundColor?: string | null;
    zIndex: number;
  }[];
}

const CATEGORY_ICON = { student: GraduationCap, staff: UserCog } as const;

/**
 * Groups templates by certificate type (Bonafide, TC, Experience Certificate...) rather than a
 * fixed category enum, since schools can add their own types. `filterTypeId` narrows the gallery
 * to one type — used when arriving from that type's "Set Template" row action.
 */
export function CertificateTemplateGallery({
  selectedId,
  onSelect,
  filterTypeId,
}: {
  selectedId: string | null;
  onSelect: (templateId: string) => void;
  filterTypeId?: string | null;
}) {
  const [types, setTypes] = useState<CertificateTypeSummary[] | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/certificate-types").then((r) => r.json()),
      fetch("/api/certificate-templates").then((r) => r.json()),
    ])
      .then(([typesBody, templatesBody]) => {
        if (cancelled) return;
        setTypes(typesBody.data ?? []);
        setTemplates(templatesBody.data ?? []);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function setFixed(template: TemplateSummary) {
    setBusyId(template.id);
    try {
      const response = await fetch(`/api/certificate-templates/${template.id}/set-default`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw body;
      toast({ title: `${template.name} is now the fixed design`, description: "New certificates of this type print with it.", variant: "success" });
      reload();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't set the fixed design", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  async function createBlank(type: CertificateTypeSummary) {
    setBusyId(`new-${type.id}`);
    try {
      const response = await fetch("/api/certificate-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateTypeId: type.id, name: `${type.name} (New)` }),
      });
      const body = await response.json();
      if (!response.ok) throw body;
      onSelect(body.id);
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't create a new template", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(template: TemplateSummary) {
    setBusyId(template.id);
    try {
      const response = await fetch(`/api/certificate-templates/${template.id}/duplicate`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw body;
      toast({ title: "Copied into your school", description: "Edit the copy, then set it as your fixed design.", variant: "success" });
      reload();
      if (body.id) onSelect(body.id);
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't duplicate the template", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorState description="Couldn't load certificate templates." onRetry={reload} />;
  if (!types || !templates) return <LoadingState />;

  const visibleTypes = filterTypeId ? types.filter((t) => t.id === filterTypeId) : types;

  return (
    <div className="flex flex-col gap-6">
      {visibleTypes.length === 0 && filterTypeId && (
        <EmptyState title="Certificate type not found" description="It may have been removed." className="py-6" />
      )}
      {visibleTypes.map((type) => {
        const Icon = CATEGORY_ICON[type.category];
        const inType = templates.filter((t) => t.certificateTypeId === type.id);
        const fixed = inType.find((t) => t.isDefault && !t.isSystemTemplate);

        return (
          <section key={type.id} aria-label={type.name}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-medium text-foreground">{type.name}</h2>
              {fixed ? <Badge variant="success">{fixed.name}</Badge> : <Badge variant="warning">Not set</Badge>}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => createBlank(type)}
                isLoading={busyId === `new-${type.id}`}
              >
                <Plus className="size-4" /> New template
              </Button>
            </div>

            {inType.length === 0 ? (
              <EmptyState
                title={`No ${type.name.toLowerCase()} templates yet`}
                description="Duplicate a starter design, or start a blank one and upload your own background art."
                className="py-6"
                action={
                  <Button size="sm" onClick={() => createBlank(type)} isLoading={busyId === `new-${type.id}`}>
                    <Plus className="size-4" /> New template
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inType.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    selected={selectedId === template.id}
                    busy={busyId === template.id}
                    onSelect={() => onSelect(template.id)}
                    onSetFixed={() => setFixed(template)}
                    onDuplicate={() => duplicate(template)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  busy,
  onSelect,
  onSetFixed,
  onDuplicate,
}: {
  template: TemplateSummary;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onSetFixed: () => void;
  onDuplicate: () => void;
}) {
  const isFixed = template.isDefault && !template.isSystemTemplate;

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border p-3 transition-colors", selected ? "border-primary-600 ring-1 ring-primary-500/30" : "border-border")}>
      <button type="button" onClick={onSelect} className="flex justify-center rounded-md bg-black/[0.04] p-3 dark:bg-white/[0.04]" aria-label={`Edit ${template.name}`}>
        {template.elements?.length ? (
          <CertificateCanvasPreview pageWidthMm={template.pageWidthMm} pageHeightMm={template.pageHeightMm} elements={template.elements as never} scale={0.22} />
        ) : (
          <div className="rounded bg-surface-raised" style={{ width: `${template.pageWidthMm * 0.22}mm`, height: `${template.pageHeightMm * 0.22}mm` }} />
        )}
      </button>

      <div className="flex flex-wrap items-center gap-1.5">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{template.name}</p>
        {isFixed && (
          <Badge variant="success">
            <Star className="size-3" aria-hidden="true" /> Fixed
          </Badge>
        )}
        {template.isSystemTemplate && <Badge variant="neutral">Starter</Badge>}
      </div>

      <div className="flex flex-wrap gap-1">
        <Button variant="secondary" size="sm" onClick={onSelect}>
          Edit
        </Button>

        {template.isSystemTemplate ? (
          <Button variant="ghost" size="sm" onClick={onDuplicate} isLoading={busy}>
            <Copy className="size-4" /> Use as base
          </Button>
        ) : isFixed ? (
          <span className="flex items-center gap-1 px-2 text-xs text-accent-600">
            <Check className="size-3.5" aria-hidden="true" /> In use
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={onSetFixed} isLoading={busy}>
            <Star className="size-4" /> Set as fixed
          </Button>
        )}
      </div>
    </div>
  );
}
