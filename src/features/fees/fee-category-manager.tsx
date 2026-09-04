"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { feeCategoryService } from "@/services/feeStructureService";
import type { FeeCategoryRecord } from "@/types/fees";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

export function FeeCategoryManager() {
  const can = useCan();
  const [rows, setRows] = useState<FeeCategoryRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FeeCategoryRecord | null>(null);
  const [deleting, setDeleting] = useState<FeeCategoryRecord | null>(null);

  // Reload counter keeps setState out of the effect body and lets a superseded response be discarded.
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    feeCategoryService
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
      const result = await feeCategoryService.remove(deleting.id);
      toast({
        title: result.deactivated ? "Fee category deactivated" : "Fee category deleted",
        description: result.deactivated
          ? `${result.items} fee structure item${result.items === 1 ? "" : "s"} still use it, so it was kept for history.`
          : undefined,
        variant: "success",
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the fee category", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load fee categories." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={4} columns={5} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} fee categor{rows.length === 1 ? "y" : "ies"}
        </p>
        {can("feeCategories", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add fee category
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No fee categories yet"
          description="Add the fee heads your school charges — Tuition Fee, Admission Fee, Transport Fee, Lab Fee, and so on."
          action={
            can("feeCategories", "create") ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add fee category
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
              <TableHead>Refundable</TableHead>
              <TableHead>Used by</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.code}</TableCell>
                <TableCell>
                  <Badge variant={row.isRefundable ? "success" : "neutral"}>{row.isRefundable ? "Refundable" : "Non-refundable"}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{row.counts?.items ?? 0} item{row.counts?.items === 1 ? "" : "s"}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "success" : "neutral"}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can("feeCategories", "edit") && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                    )}
                    {can("feeCategories", "delete") && (
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

      <FeeCategoryModal
        key={editing?.id ?? "new"}
        open={creating || Boolean(editing)}
        feeCategory={editing}
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
        title={`Remove ${deleting?.name ?? "fee category"}?`}
        description={
          (deleting?.counts?.items ?? 0) > 0
            ? `${deleting?.counts?.items} fee structure item(s) use this category, so it will be deactivated rather than deleted.`
            : "This fee category isn't in use and will be deleted permanently."
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function FeeCategoryModal({
  open,
  feeCategory,
  onClose,
  onSaved,
}: {
  open: boolean;
  feeCategory: FeeCategoryRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(feeCategory?.name ?? "");
  const [code, setCode] = useState(feeCategory?.code ?? "");
  const [description, setDescription] = useState(feeCategory?.description ?? "");
  const [isRefundable, setIsRefundable] = useState(feeCategory?.isRefundable ?? false);
  const [sortOrder, setSortOrder] = useState(String(feeCategory?.sortOrder ?? 0));
  const [status, setStatus] = useState(feeCategory?.status ?? "active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleName(value: string) {
    setName(value);
    if (!feeCategory) {
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
        isRefundable,
        sortOrder: Number(sortOrder) || 0,
        status: status as "active" | "inactive",
      };
      if (feeCategory) await feeCategoryService.update(feeCategory.id, payload);
      else await feeCategoryService.create(payload);

      toast({ title: feeCategory ? "Fee category updated" : "Fee category created", variant: "success" });
      onSaved();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the fee category.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={feeCategory ? `Edit ${feeCategory.name}` : "Add fee category"}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Name" required error={fieldErrors.name?.[0]}>
            {(field) => <Input {...field} value={name} onChange={(e) => handleName(e.target.value)} placeholder="Tuition Fee" />}
          </FormField>

          <FormField label="Code" required error={fieldErrors.code?.[0]}>
            {(field) => <Input {...field} value={code} onChange={(e) => setCode(e.target.value)} />}
          </FormField>

          <FormField label="Description">
            {(field) => <Textarea {...field} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </FormField>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Refundable</p>
              <p className="text-xs text-muted-foreground">e.g. a caution deposit that&apos;s returned later.</p>
            </div>
            <Switch checked={isRefundable} onCheckedChange={setIsRefundable} aria-label="Refundable" />
          </div>

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
              {feeCategory ? "Save changes" : "Create fee category"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
