"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Copy, Check, ExternalLink, Plus } from "lucide-react";
import { schoolStructureService } from "@/services/schoolStructureService";
import type { SchoolStructure } from "@/types/student";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

interface FormRecord {
  id: string;
  token: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt: string;
  counts: { total: number; pending: number };
}

/**
 * Creates and shares the parent-facing admission form.
 *
 * The link is a random token, not a school id — it can't be guessed or walked,
 * and deactivating the form revokes it. Submissions never become students on
 * their own; they queue for review.
 */
export function RegistrationFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [forms, setForms] = useState<FormRecord[] | null>(null);
  const [structure, setStructure] = useState<SchoolStructure | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("Admission enquiry form");
  const [description, setDescription] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    fetch("/api/registration-forms")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body;
      })
      .then((body) => {
        if (!cancelled) setForms(body.data);
      })
      .catch(() => {
        if (!cancelled) setForms([]);
      });

    schoolStructureService
      .get()
      .then((s) => {
        if (cancelled) return;
        setStructure(s);
        setAcademicYearId(s.academicYears.find((y) => y.isCurrent)?.id ?? "");
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [open, reloadKey]);

  function publicUrl(token: string): string {
    return `${window.location.origin}/register/${token}`;
  }

  async function copyLink(form: FormRecord) {
    try {
      await navigator.clipboard.writeText(publicUrl(form.token));
      setCopiedId(form.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Link copied", description: "Share it with parents over WhatsApp, SMS or email.", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy — select the link and copy it manually.", variant: "danger" });
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/registration-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          academicYearId: academicYearId || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw json as ApiError;

      toast({ title: "Form created", description: "Copy the link and send it to parents.", variant: "success" });
      setCreating(false);
      setDescription("");
      setExpiresAt("");
      reload();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't create the form.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title="Parent admission form"
        description="Share a link so parents fill in their child's details themselves. Submissions queue for your review — they never create a student directly."
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          {!creating && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> New form
              </Button>
            </div>
          )}

          {creating && (
            <div className="flex flex-col gap-3 rounded-md border border-border p-4">
              <FormField label="Title" required description="Parents see this at the top of the form">
                {(f) => <Input {...f} value={title} onChange={(e) => setTitle(e.target.value)} />}
              </FormField>

              <FormField label="Instructions" description="Optional note shown under the title">
                {(f) => (
                  <Textarea {...f} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                )}
              </FormField>

              <FormField label="Academic year">
                {(f) => (
                  <Select value={academicYearId} onValueChange={setAcademicYearId}>
                    <SelectTrigger id={f.id}>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {(structure?.academicYears ?? []).map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField label="Stop accepting after" description="Optional — the link stops working on this date">
                {(f) => <Input {...f} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />}
              </FormField>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setCreating(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button size="sm" onClick={create} isLoading={busy} disabled={!title.trim()}>
                  Create form
                </Button>
              </div>
            </div>
          )}

          {!forms && <LoadingState />}

          {forms?.length === 0 && !creating && (
            <EmptyState
              icon={Link2}
              title="No parent forms yet"
              description="Create one to get a shareable link parents can fill in from their phone."
            />
          )}

          {forms && forms.length > 0 && (
            <ul className="flex flex-col gap-3">
              {forms.map((form) => (
                <li key={form.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{form.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {form.counts.total} submission{form.counts.total === 1 ? "" : "s"}
                        {form.counts.pending > 0 && ` · ${form.counts.pending} awaiting review`}
                        {form.expiresAt && ` · closes ${form.expiresAt.slice(0, 10)}`}
                      </p>
                    </div>
                    <Badge variant={form.isActive ? "success" : "neutral"}>
                      {form.isActive ? "Accepting" : "Closed"}
                    </Badge>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
                      {typeof window !== "undefined" ? publicUrl(form.token) : `/register/${form.token}`}
                    </code>
                    <Button variant="secondary" size="sm" onClick={() => copyLink(form)}>
                      {copiedId === form.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copiedId === form.id ? "Copied" : "Copy link"}
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <a href={`/register/${form.token}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" /> Open
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {forms && forms.some((f) => f.counts.pending > 0) && (
            <Alert variant="info">
              Submissions are waiting for review. Open <strong>Admissions → Applications</strong> to approve them
              into student records.
            </Alert>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
