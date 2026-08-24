"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, BadgeCheck } from "lucide-react";
import { employeeTypeService } from "@/services/hrService";
import type { EmployeeTypeRecord } from "@/types/hr";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function EmployeeTypeManager() {
  const can = useCan();
  const [rows, setRows] = useState<EmployeeTypeRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EmployeeTypeRecord | null>(null);
  const [deleting, setDeleting] = useState<EmployeeTypeRecord | null>(null);

  // See designation-manager: a reload counter keeps setState out of the effect
  // body and lets a superseded response be discarded.
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    employeeTypeService
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
      const result = await employeeTypeService.remove(deleting.id);
      toast({
        title: result.deactivated ? "Employee type deactivated" : "Employee type deleted",
        description: result.deactivated
          ? `${result.employees} employee${result.employees === 1 ? "" : "s"} still use it, so it was kept for history.`
          : undefined,
        variant: "success",
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the employee type", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load employee types." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={4} columns={4} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} employee type{rows.length === 1 ? "" : "s"}
        </p>
        {can("employeeTypes", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add employee type
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="No employee types yet"
          description="Add the employment types your school uses — Permanent, Contract, Visiting Faculty, Intern, and so on."
          action={
            can("employeeTypes", "create") ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add employee type
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
              <TableHead>Paid</TableHead>
              <TableHead>Employees</TableHead>
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
                  <Badge variant={row.isPaid ? "success" : "neutral"}>{row.isPaid ? "Paid" : "Unpaid"}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{row.counts?.employees ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "success" : "neutral"}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can("employeeTypes", "edit") && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                    )}
                    {can("employeeTypes", "delete") && (
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

      <EmployeeTypeModal
        key={editing?.id ?? "new"}
        open={creating || Boolean(editing)}
        employeeType={editing}
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
        title={`Remove ${deleting?.name ?? "employee type"}?`}
        description={
          (deleting?.counts?.employees ?? 0) > 0
            ? `${deleting?.counts?.employees} employee(s) use this type, so it will be deactivated rather than deleted.`
            : "This employee type isn't in use and will be deleted permanently."
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function EmployeeTypeModal({
  open,
  employeeType,
  onClose,
  onSaved,
}: {
  open: boolean;
  employeeType: EmployeeTypeRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(employeeType?.name ?? "");
  const [code, setCode] = useState(employeeType?.code ?? "");
  const [isPaid, setIsPaid] = useState(employeeType?.isPaid ?? true);
  const [sortOrder, setSortOrder] = useState(String(employeeType?.sortOrder ?? 0));
  const [status, setStatus] = useState(employeeType?.status ?? "active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleName(value: string) {
    setName(value);
    if (!employeeType) {
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
        isPaid,
        sortOrder: Number(sortOrder) || 0,
        status: status as "active" | "inactive",
      };
      if (employeeType) await employeeTypeService.update(employeeType.id, payload);
      else await employeeTypeService.create(payload);

      toast({ title: employeeType ? "Employee type updated" : "Employee type created", variant: "success" });
      onSaved();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the employee type.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={employeeType ? `Edit ${employeeType.name}` : "Add employee type"}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Name" required error={fieldErrors.name?.[0]}>
            {(field) => (
              <Input {...field} value={name} onChange={(e) => handleName(e.target.value)} placeholder="Visiting Faculty" />
            )}
          </FormField>

          <FormField label="Code" required error={fieldErrors.code?.[0]}>
            {(field) => <Input {...field} value={code} onChange={(e) => setCode(e.target.value)} />}
          </FormField>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Paid type</p>
              <p className="text-xs text-muted-foreground">
                Unpaid types are skipped by payroll without matching on the name.
              </p>
            </div>
            <Switch checked={isPaid} onCheckedChange={setIsPaid} aria-label="Paid type" />
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
              {employeeType ? "Save changes" : "Create employee type"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
