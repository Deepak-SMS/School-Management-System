"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { libraryCategoryService } from "@/services/libraryService";
import type { LibraryCategoryRecord } from "@/types/library";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function LibraryCategoryManager() {
  const can = useCan();
  const [rows, setRows] = useState<LibraryCategoryRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LibraryCategoryRecord | null>(null);
  const [deleting, setDeleting] = useState<LibraryCategoryRecord | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    libraryCategoryService
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
      await libraryCategoryService.remove(deleting.id);
      toast({ title: "Category removed", variant: "success" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the category", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load library categories." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={4} columns={4} />;

  const parentName = (id?: string | null) => rows.find((r) => r.id === id)?.name;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} categor{rows.length === 1 ? "y" : "ies"}
        </p>
        {can("libraryCatalogue", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add category
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No library categories yet"
          description="Add the classifications your school files books under — Fiction, Science, Reference, and so on."
          action={
            can("libraryCatalogue", "create") ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add category
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Books</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.name}
                  {row.isSystemCategory && (
                    <Badge variant="neutral" className="ml-2">
                      Starter
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{parentName(row.parentId) ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{row.counts?.books ?? 0}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can("libraryCatalogue", "edit") && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                    )}
                    {can("libraryCatalogue", "delete") && (
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

      <CategoryModal
        key={editing?.id ?? "new"}
        open={creating || Boolean(editing)}
        category={editing}
        parentOptions={rows.filter((r) => r.id !== editing?.id)}
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
        title={`Remove ${deleting?.name ?? "category"}?`}
        description={
          (deleting?.counts?.books ?? 0) > 0
            ? `${deleting?.counts?.books} book(s) use this category — reassign them first.`
            : "This category isn't in use and will be deleted permanently."
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CategoryModal({
  open,
  category,
  parentOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  category: LibraryCategoryRecord | null;
  parentOptions: LibraryCategoryRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = { name, parentId: parentId || undefined };
      if (category) await libraryCategoryService.update(category.id, payload);
      else await libraryCategoryService.create(payload);

      toast({ title: category ? "Category updated" : "Category created", variant: "success" });
      onSaved();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the category.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={category ? `Edit ${category.name}` : "Add category"}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Name" required error={fieldErrors.name?.[0]}>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Fiction" />}
          </FormField>

          <FormField label="Parent category" description="Optional — nests this under a broader category.">
            {(field) => (
              <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v)}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              {category ? "Save changes" : "Create category"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
