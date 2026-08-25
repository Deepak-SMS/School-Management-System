"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Star, GraduationCap, Users, UserCog } from "lucide-react";
import { CardCanvasPreview } from "@/features/id-cards/card-canvas-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

interface TemplateSummary {
  id: string;
  name: string;
  category: string;
  isSystemTemplate: boolean;
  isDefault: boolean;
  isActive: boolean;
  cardWidthMm: number;
  cardHeightMm: number;
  cornerRadiusMm: number;
  orientation: string;
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

/**
 * The three designs a school fixes — one per kind of card it prints. Grouping by
 * these rather than showing a flat list is what makes "which design do teachers
 * get" answerable at a glance.
 */
const CATEGORIES = [
  { value: "student", label: "Students", icon: GraduationCap },
  { value: "teacher", label: "Teachers", icon: Users },
  { value: "staff", label: "Other staff", icon: UserCog },
] as const;

export function TemplateBrowser({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (templateId: string) => void;
}) {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/id-card-templates")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setTemplates(body.data ?? body);
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
      const response = await fetch(`/api/id-card-templates/${template.id}/set-default`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw body;
      toast({
        title: `${template.name} is now the fixed design`,
        description: "New cards for this category print with it.",
        variant: "success",
      });
      reload();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't set the fixed design", variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(template: TemplateSummary) {
    setBusyId(template.id);
    try {
      const response = await fetch(`/api/id-card-templates/${template.id}/duplicate`, { method: "POST" });
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

  if (error) return <ErrorState description="Couldn't load templates." onRetry={reload} />;
  if (!templates) return <LoadingState />;

  return (
    <div className="flex flex-col gap-6">
      {CATEGORIES.map((category) => {
        const Icon = category.icon;
        // "staff" also covers legacy templates saved as "custom", so nothing is
        // stranded in a group the school can't see.
        const inCategory = templates.filter((t) =>
          category.value === "staff"
            ? t.category === "staff" || t.category === "custom"
            : t.category === category.value,
        );
        const fixed = inCategory.find((t) => t.isDefault && !t.isSystemTemplate);

        return (
          <section key={category.value} aria-label={category.label}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-medium text-foreground">Fixed design for {category.label.toLowerCase()}</h2>
              {fixed ? (
                <Badge variant="success">{fixed.name}</Badge>
              ) : (
                <Badge variant="warning">Not set</Badge>
              )}
            </div>

            {inCategory.length === 0 ? (
              <EmptyState
                title={`No ${category.label.toLowerCase()} templates yet`}
                description="Duplicate a starter design from another category, or create one."
                className="py-6"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inCategory.map((template) => (
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
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 transition-colors",
        selected ? "border-primary-600 ring-1 ring-primary-500/30" : "border-border",
      )}
    >
      {/* A real render of the design, not a generic thumbnail — the point is to
          recognise the card you're about to edit. */}
      <button
        type="button"
        onClick={onSelect}
        className="flex justify-center rounded-md bg-black/[0.04] p-3 dark:bg-white/[0.04]"
        aria-label={`Edit ${template.name}`}
      >
        {template.elements?.length ? (
          <CardCanvasPreview
            cardWidthMm={template.cardWidthMm}
            cardHeightMm={template.cardHeightMm}
            cornerRadiusMm={template.cornerRadiusMm}
            elements={template.elements as never}
            side="front"
            scale={0.62}
          />
        ) : (
          <div
            className="rounded bg-surface-raised"
            style={{ width: `${template.cardWidthMm * 0.62}mm`, height: `${template.cardHeightMm * 0.62}mm` }}
          />
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
          // Starter templates are shared across schools, so they're copied rather
          // than edited or fixed in place.
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
