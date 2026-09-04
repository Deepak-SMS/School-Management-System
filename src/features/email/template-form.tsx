"use client";

import { useEffect, useState } from "react";
import { Modal, ModalContent, ModalFooter } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { EMAIL_TEMPLATE_CATEGORY_VALUES } from "@/lib/validation/email-template";
import { personalizeMessage, personalizeHtml } from "@/lib/communication/personalize";
import { EMAIL_SAMPLE_VALUES } from "@/lib/email-campaigns/variables";
import { VariablePicker } from "@/features/email/variable-picker";
import { emailTemplateService, type EmailTemplateRecord } from "@/services/emailTemplateService";

const CATEGORY_LABELS: Record<string, string> = {
  fee: "Fee",
  attendance: "Attendance",
  exam: "Exam",
  result: "Result",
  ptm: "PTM",
  homework: "Homework",
  announcement: "Announcement",
  holiday: "Holiday",
  general: "General",
  custom: "Custom",
};

interface TemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: EmailTemplateRecord | null;
  onSaved: () => void;
}

export function TemplateForm({ open, onOpenChange, template, onSaved }: TemplateFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setCategory(template?.category ?? "general");
    setSubject(template?.subject ?? "");
    setBodyHtml(template?.bodyHtml ?? "");
  }, [open, template]);

  function insertIntoBody(token: string) {
    // Relies on the RichTextEditor's own contentEditable retaining focus/
    // selection (VariablePicker's buttons preventDefault on mousedown for
    // exactly this) — execCommand inserts at the real cursor position, and
    // the editor's own onInput listener picks up the change automatically.
    document.execCommand("insertText", false, `{{${token}}}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const input = { name, category, subject, bodyHtml };
      if (template) await emailTemplateService.update(template.id, input);
      else await emailTemplateService.create(input);
      toast({ title: template ? "Template updated" : "Template created", variant: "success" });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast({ title: "Couldn't save template", description: (err as { error?: string }).error, variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  const subjectPreview = personalizeMessage(subject, EMAIL_SAMPLE_VALUES);
  const bodyPreview = personalizeHtml(bodyHtml, EMAIL_SAMPLE_VALUES);
  const missingVariables = [...new Set([...subjectPreview.missingVariables, ...bodyPreview.missingVariables])];

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title={template ? "Edit Template" : "New Template"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <FormField label="Template name" required>
              {(f) => <Input {...f} value={name} onChange={(e) => setName(e.target.value)} required />}
            </FormField>
            <FormField label="Category" required>
              {() => (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMAIL_TEMPLATE_CATEGORY_VALUES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>

          <FormField label="Subject" required description="Click a variable below to insert it here too.">
            {(f) => <Input {...f} value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={300} />}
          </FormField>

          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="max-h-96 overflow-y-auto rounded-md border border-border p-3">
              <VariablePicker onInsert={insertIntoBody} />
            </div>
            <div className="space-y-3">
              <FormField label="Message" required>
                {() => <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Dear {{parent.name}}, ..." className="min-h-64" />}
              </FormField>

              <Card>
                <CardContent className="space-y-2 pt-4">
                  <p className="text-xs font-medium text-muted-foreground">Live preview (sample data)</p>
                  <p className="text-sm font-medium text-foreground">{subjectPreview.text || "Subject will appear here…"}</p>
                  <div className="rounded-md bg-background p-3 text-sm text-foreground [&_a]:text-primary-600 [&_a]:underline [&_h2]:text-base [&_h2]:font-semibold [&_hr]:my-2 [&_hr]:border-border [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: bodyPreview.text || "Your message will appear here…" }} />
                  {missingVariables.length > 0 && <p className="text-xs text-danger-600">Unknown variable(s): {missingVariables.join(", ")}</p>}
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
