"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, MoreVertical } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useCan } from "@/hooks/use-can";
import { whatsappTemplateService, type WhatsAppTemplateRecord } from "@/services/whatsappTemplateService";
import { TemplateForm } from "@/features/whatsapp/template-form";

const CATEGORY_LABELS: Record<string, string> = {
  fee_reminder: "Fee Reminder",
  attendance: "Attendance",
  exam: "Exam",
  event: "Event",
  admission: "Admission",
  general: "General",
  custom: "Custom",
};

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates] = useState<WhatsAppTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsAppTemplateRecord | null>(null);
  const can = useCan();
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await whatsappTemplateService.list();
      setTemplates(result.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(t: WhatsAppTemplateRecord) {
    try {
      await whatsappTemplateService.remove(t.id);
      toast({ title: "Template deleted", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Couldn't delete template", description: (err as { error?: string }).error, variant: "danger" });
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <Breadcrumb items={[{ label: "Communication", href: "/communication/whatsapp" }, { label: "WhatsApp", href: "/communication/whatsapp" }, { label: "Templates" }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Message Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">Reusable messages with {"{{variables}}"} personalized per recipient.</p>
        </div>
        {can("whatsappTemplates", "create") && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="size-4" /> New Template
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : templates.length === 0 ? (
        <EmptyState title="No templates yet" description="Create a reusable message with variables like {{student.name}}." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant="neutral" className="mt-1">{CATEGORY_LABELS[t.category] ?? t.category}</Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="size-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {can("whatsappTemplates", "edit") && <DropdownMenuItem onSelect={() => { setEditing(t); setFormOpen(true); }}>Edit</DropdownMenuItem>}
                    {can("whatsappTemplates", "delete") && <DropdownMenuItem onSelect={() => handleDelete(t)} className="text-danger-600">Delete</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{t.bodyText}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateForm open={formOpen} onOpenChange={setFormOpen} template={editing} onSaved={load} />
    </div>
  );
}
