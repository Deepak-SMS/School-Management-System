"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { feeStudentCategoryService } from "@/services/feeStructureService";
import type { FeeStudentCategoryRecord } from "@/types/fees";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

export function FeeStudentCategoryManager() {
  const can = useCan();
  const [rows, setRows] = useState<FeeStudentCategoryRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FeeStudentCategoryRecord | null>(null);
  const [deleting, setDeleting] = useState<FeeStudentCategoryRecord | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    feeStudentCategoryService
      .list()
      .then((r) => {
        if (cancelled) return;
        setRows(r.data);
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
      const result = await feeStudentCategoryService.remove(deleting.id);
      toast({
        title: result.deactivated ? "Student category deactivated" : "Student category deleted",
        description: result.deactivated ? "It's still in use, so it was kept for history." : undefined,
        variant: "success",
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the student category", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load student categories." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={4} columns={5} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} student categor{rows.length === 1 ? "y" : "ies"}
        </p>
        {can("feeStudentCategories", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add student category
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No student categories yet"
          description="Add the fee-purpose groupings your school uses — General, RTE, Staff Ward, Sibling, Management Quota — to give a subset of students a different fee structure."
          action={
            can("feeStudentCategories", "create") ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add student category
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Fee structures</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.code}</TableCell>
                <TableCell className="tabular-nums">{row.counts?.students ?? 0}</TableCell>
                <TableCell className="tabular-nums">{row.counts?.feeStructures ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "success" : "neutral"}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can("feeStudentCategories", "edit") && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                    )}
                    {can("feeStudentCategories", "delete") && (
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

      <FeeStudentCategoryModal
        key={editing?.id ?? "new"}
        open={creating || Boolean(editing)}
        category={editing}
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
        title={`Remove ${deleting?.name ?? "student category"}?`}
        description={
          (deleting?.counts?.students ?? 0) > 0 || (deleting?.counts?.feeStructures ?? 0) > 0
            ? "This category is still in use, so it will be deactivated rather than deleted."
            : "This student category isn't in use and will be deleted permanently."
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function FeeStudentCategoryModal({
  open,
  category,
  onClose,
  onSaved,
}: {
  open: boolean;
  category: FeeStudentCategoryRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [code, setCode] = useState(category?.code ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [status, setStatus] = useState(category?.status ?? "active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleName(value: string) {
    setName(value);
    if (!category) {
      setCode(value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20));
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = {
        name,
        code,
        description: description || undefined,
        sortOrder: Number(sortOrder) || 0,
        status: status as "active" | "inactive",
      };
      if (category) await feeStudentCategoryService.update(category.id, payload);
      else await feeStudentCategoryService.create(payload);

      toast({ title: category ? "Student category updated" : "Student category created", variant: "success" });
      onSaved();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the student category.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={category ? `Edit ${category.name}` : "Add student category"}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Name" required error={fieldErrors.name?.[0]}>
            {(field) => <Input {...field} value={name} onChange={(e) => handleName(e.target.value)} placeholder="Staff Ward" />}
          </FormField>

          <FormField label="Code" required error={fieldErrors.code?.[0]}>
            {(field) => <Input {...field} value={code} onChange={(e) => setCode(e.target.value)} />}
          </FormField>

          <FormField label="Description">
            {(field) => <Textarea {...field} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </FormField>

          <FormField label="Sort order" description="Controls the order in dropdowns">
            {(field) => (
              <Input {...field} type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            )}
          </FormField>

          <FormField label="Status">
            {(field) => (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              {category ? "Save changes" : "Create student category"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
