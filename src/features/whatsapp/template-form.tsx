"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, ModalContent, ModalFooter } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { WHATSAPP_TEMPLATE_CATEGORY_VALUES } from "@/lib/validation/whatsapp-template";
import { personalizeMessage } from "@/lib/communication/personalize";
import { WHATSAPP_SAMPLE_VALUES } from "@/lib/whatsapp/variables";
import { VariablePicker } from "@/features/whatsapp/variable-picker";
import { whatsappTemplateService, type WhatsAppTemplateRecord } from "@/services/whatsappTemplateService";

const CATEGORY_LABELS: Record<string, string> = {
  fee_reminder: "Fee Reminder",
  attendance: "Attendance",
  exam: "Exam",
  event: "Event",
  admission: "Admission",
  general: "General",
  custom: "Custom",
};

interface TemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: WhatsAppTemplateRecord | null;
  onSaved: () => void;
}

export function TemplateForm({ open, onOpenChange, template, onSaved }: TemplateFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setCategory(template?.category ?? "general");
    setBodyText(template?.bodyText ?? "");
  }, [open, template]);

  function insertVariable(token: string) {
    const el = textareaRef.current;
    const insertion = `{{${token}}}`;
    if (!el) {
      setBodyText((prev) => prev + insertion);
      return;
    }
    const start = el.selectionStart ?? bodyText.length;
    const end = el.selectionEnd ?? bodyText.length;
    const next = bodyText.slice(0, start) + insertion + bodyText.slice(end);
    setBodyText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + insertion.length;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (template) await whatsappTemplateService.update(template.id, { name, category, bodyText });
      else await whatsappTemplateService.create({ name, category, bodyText });
      toast({ title: template ? "Template updated" : "Template created", variant: "success" });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast({ title: "Couldn't save template", description: (err as { error?: string }).error, variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  const preview = personalizeMessage(bodyText, WHATSAPP_SAMPLE_VALUES);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title={template ? "Edit Template" : "New Template"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Template name" required>
              {(f) => <Input {...f} value={name} onChange={(e) => setName(e.target.value)} required />}
            </FormField>
            <FormField label="Category" required>
              {() => (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WHATSAPP_TEMPLATE_CATEGORY_VALUES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>

          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="max-h-72 overflow-y-auto rounded-md border border-border p-3">
              <VariablePicker onInsert={insertVariable} />
            </div>
            <div className="space-y-3">
              <FormField label="Message" required description="Click a variable on the left to insert it at the cursor.">
                {(f) => (
                  <Textarea
                    {...f}
                    ref={textareaRef}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    rows={8}
                    required
                    maxLength={4096}
                  />
                )}
              </FormField>
              <p className="text-right text-xs text-muted-foreground">{bodyText.length} / 4096</p>

              <Card>
                <CardContent className="space-y-2 pt-4">
                  <p className="text-xs font-medium text-muted-foreground">Live preview (sample data)</p>
                  <p className="whitespace-pre-wrap rounded-md bg-background p-3 text-sm text-foreground">{preview.text || "Your message will appear here…"}</p>
                  {preview.missingVariables.length > 0 && (
                    <p className="text-xs text-danger-600">Unknown variable(s): {preview.missingVariables.join(", ")}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <ModalFooter className="-mx-5 -mb-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" isLoading={saving}>{template ? "Save changes" : "Create template"}</Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
