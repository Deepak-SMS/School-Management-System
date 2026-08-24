"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LayoutTemplate } from "lucide-react";
import { CardCanvasPreview, type RenderableElement } from "@/features/id-cards/card-canvas-preview";
import { SAMPLE_CARD_DATA } from "@/features/id-cards/sample-card-data";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";

interface TemplateRecord {
  id: string;
  name: string;
  isSystemTemplate: boolean;
  orientation: string;
  cardWidthMm: number;
  cardHeightMm: number;
  cornerRadiusMm: number;
  elements: RenderableElement[];
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  function load() {
    setError(false);
    fetch("/api/id-card-templates")
      .then((r) => r.json())
      .then((body) => setTemplates(body.data))
      .catch(() => setError(true));
  }

  useEffect(() => {
    fetch("/api/id-card-templates")
      .then((r) => r.json())
      .then((body) => setTemplates(body.data))
      .catch(() => setError(true));
  }, []);

  async function applyTemplate(templateId: string) {
    setDuplicatingId(templateId);
    try {
      const res = await fetch(`/api/id-card-templates/${templateId}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error();
      const created = await res.json();
      toast({ title: "Template saved to My School Templates", description: created.name, variant: "success" });
      load();
    } catch {
      toast({ title: "Couldn't duplicate template", variant: "danger" });
    } finally {
      setDuplicatingId(null);
    }
  }

  if (error) return <ErrorState className="mx-auto max-w-6xl px-6 py-16" onRetry={load} />;
  if (!templates) return <LoadingState className="mx-auto max-w-6xl px-6 py-16" />;

  const systemTemplates = templates.filter((t) => t.isSystemTemplate);
  const schoolTemplates = templates.filter((t) => !t.isSystemTemplate);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">ID Card Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start from a system template, then customize and save your own. Original system templates are never modified.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">System templates</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systemTemplates.map((tpl) => (
            <TemplateCard key={tpl.id} template={tpl} onUse={() => applyTemplate(tpl.id)} isDuplicating={duplicatingId === tpl.id} router={router} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">My school templates</h2>
        {schoolTemplates.length === 0 ? (
          <Card>
            <EmptyState
              icon={LayoutTemplate}
              title="No school templates yet"
              description="Use a system template above to create your first customized template."
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {schoolTemplates.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} onUse={() => applyTemplate(tpl.id)} isDuplicating={duplicatingId === tpl.id} router={router} isSchoolOwned />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
  isDuplicating,
  router,
  isSchoolOwned,
}: {
  template: TemplateRecord;
  onUse: () => void;
  isDuplicating: boolean;
  router: ReturnType<typeof useRouter>;
  isSchoolOwned?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-center bg-background p-4">
        <CardCanvasPreview
          cardWidthMm={template.cardWidthMm}
          cardHeightMm={template.cardHeightMm}
          cornerRadiusMm={template.cornerRadiusMm}
          elements={template.elements}
          side="front"
          sampleData={SAMPLE_CARD_DATA}
          scale={1.8}
        />
      </div>
      <CardContent className="flex flex-col gap-1.5 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{template.name}</p>
          <Badge variant={isSchoolOwned ? "primary" : "neutral"}>{isSchoolOwned ? "School" : "System"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {template.orientation} · {template.cardWidthMm} × {template.cardHeightMm} mm
        </p>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/id-cards/designer?templateId=${template.id}`)}>
          Preview / Edit
        </Button>
        <Button size="sm" onClick={onUse} isLoading={isDuplicating}>
          <Copy className="size-4" /> {isSchoolOwned ? "Duplicate" : "Use template"}
        </Button>
      </CardFooter>
    </Card>
  );
}
