"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ClipboardList } from "lucide-react";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { EXAM_CATEGORIES, EXAM_CATEGORY_LABELS } from "@/lib/constants/exam";
import type { ExamTypeRecord } from "@/types/examType";
import type { ApiError } from "@/services/studentService";

export function ExamTypeManager() {
  const can = useCan();
  const [rows, setRows] = useState<ExamTypeRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<ExamTypeRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ExamTypeRecord | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/exam-types")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setRows(body.data);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/exam-types/${deleting.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw body;
      toast({
        title: body.deactivated ? "Exam type deactivated" : "Exam type deleted",
        description: body.deactivated ? `${body.examsUsingType} exam(s) already reference it, so it was kept for history.` : undefined,
        variant: "success",
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the exam type", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load exam types." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={5} columns={5} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} exam type{rows.length === 1 ? "" : "s"}
        </p>
        {can("examTypes", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add exam type
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No exam types yet"
          description="An exam type — Unit Test, Quarterly, Half-Yearly, Annual — is what Exam Creation is scheduled against."
          action={can("examTypes", "create") ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> Add exam type</Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{row.code}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{EXAM_CATEGORY_LABELS[row.examCategory as keyof typeof EXAM_CATEGORY_LABELS] ?? row.examCategory}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "success" : "neutral"}>{row.status === "active" ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can("examTypes", "edit") && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                    )}
                    {can("examTypes", "delete") && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(row)}>
                        <Trash2 className="size-4" /> Remove
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ExamTypeModal
        key={editing?.id ?? "new"}
        open={creating || Boolean(editing)}
        examType={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          load();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remove ${deleting?.name ?? "exam type"}?`}
        description="If exams have already been created under this type, it will be deactivated instead of deleted so their history stays intact."
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ExamTypeModal({
  open,
  examType,
  onClose,
  onSaved,
}: {
  open: boolean;
  examType: ExamTypeRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(examType?.name ?? "");
  const [code, setCode] = useState(examType?.code ?? "");
  const [examCategory, setExamCategory] = useState<(typeof EXAM_CATEGORIES)[number]>((examType?.examCategory as (typeof EXAM_CATEGORIES)[number]) ?? "summative");
  const [sortOrder, setSortOrder] = useState(String(examType?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(examType ? examType.status === "active" : true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleName(value: string) {
    setName(value);
    if (!examType) setCode(value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = { name, code, examCategory, sortOrder: Number(sortOrder) || 0, status: isActive ? "active" : "inactive" };
      const res = await fetch(examType ? `/api/exam-types/${examType.id}` : "/api/exam-types", {
        method: examType ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw body;
      toast({ title: examType ? "Exam type updated" : "Exam type created", variant: "success" });
      onSaved();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the exam type.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={examType ? `Edit ${examType.name}` : "Add exam type"}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Name" required error={fieldErrors.name?.[0]}>
            {(field) => <Input {...field} value={name} onChange={(e) => handleName(e.target.value)} placeholder="Quarterly Examination" />}
          </FormField>

          <FormField label="Code" required error={fieldErrors.code?.[0]} description="Short identifier used on the exam list, e.g. QUARTERLY">
            {(field) => <Input {...field} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="QUARTERLY" />}
          </FormField>

          <FormField label="Category" required>
            {(field) => (
              <Select value={examCategory} onValueChange={(v) => setExamCategory(v as (typeof EXAM_CATEGORIES)[number])}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {EXAM_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Display order" error={fieldErrors.sortOrder?.[0]}>
            {(field) => <Input {...field} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />}
          </FormField>

          <FormField label="Active" description="Inactive types are hidden from Exam Creation but keep existing exams intact.">
            {() => <Switch checked={isActive} onCheckedChange={setIsActive} />}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              {examType ? "Save changes" : "Create exam type"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
