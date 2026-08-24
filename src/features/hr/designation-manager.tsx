"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { designationService, hrLookupService } from "@/services/hrService";
import { codeFromName } from "@/lib/validation/designation";
import type { DesignationRecord, HrLookups } from "@/types/hr";
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

export function DesignationManager() {
  const can = useCan();
  const [rows, setRows] = useState<DesignationRecord[] | null>(null);
  const [lookups, setLookups] = useState<HrLookups | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<DesignationRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<DesignationRecord | null>(null);

  // A counter rather than a callback, so state is only ever set from an async
  // callback — never synchronously in the effect body — and a superseded
  // response can't overwrite a newer one.
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    designationService
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

  useEffect(() => {
    hrLookupService.all().then(setLookups).catch(() => undefined);
  }, []);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const result = await designationService.remove(deleting.id);
      toast({
        title: result.deactivated ? "Designation deactivated" : "Designation deleted",
        description: result.deactivated
          ? `${result.employees} employee${result.employees === 1 ? "" : "s"} still hold it, so it was kept for history.`
          : undefined,
        variant: "success",
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the designation", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load designations." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={5} columns={4} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} designation{rows.length === 1 ? "" : "s"}
        </p>
        {can("designations", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add designation
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No designations yet"
          description="Designations are the job titles employees hold — each school defines its own."
          action={
            can("designations", "create") ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add designation
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
              <TableHead>Department</TableHead>
              <TableHead>Level</TableHead>
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
                <TableCell>{row.department?.name ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{row.level}</TableCell>
                <TableCell className="tabular-nums">{row.counts?.employees ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "success" : "neutral"}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can("designations", "edit") && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                    )}
                    {can("designations", "delete") && (
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

      <DesignationModal
        key={editing?.id ?? "new"}
        open={creating || Boolean(editing)}
        designation={editing}
        departments={lookups?.departments ?? []}
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
        title={`Remove ${deleting?.name ?? "designation"}?`}
        description={
          (deleting?.counts?.employees ?? 0) > 0
            ? `${deleting?.counts?.employees} employee(s) hold this designation, so it will be deactivated rather than deleted — their history stays intact.`
            : "This designation isn't in use and will be deleted permanently."
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function DesignationModal({
  open,
  designation,
  departments,
  onClose,
  onSaved,
}: {
  open: boolean;
  designation: DesignationRecord | null;
  departments: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(designation?.name ?? "");
  const [code, setCode] = useState(designation?.code ?? "");
  const [departmentId, setDepartmentId] = useState(designation?.departmentId ?? "");
  const [level, setLevel] = useState(String(designation?.level ?? 0));
  const [description, setDescription] = useState(designation?.description ?? "");
  const [status, setStatus] = useState(designation?.status ?? "active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Codes are derived from the name while creating, but never silently rewritten
  // on an existing record — the code may already be referenced elsewhere.
  function handleName(value: string) {
    setName(value);
    if (!designation) setCode(codeFromName(value));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = {
        name,
        code,
        departmentId: departmentId || undefined,
        level: Number(level) || 0,
        description: description || undefined,
        status: status as "active" | "inactive",
      };
      if (designation) await designationService.update(designation.id, payload);
      else await designationService.create(payload);

      toast({ title: designation ? "Designation updated" : "Designation created", variant: "success" });
      onSaved();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the designation.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={designation ? `Edit ${designation.name}` : "Add designation"}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Name" required error={fieldErrors.name?.[0]}>
            {(field) => (
              <Input {...field} value={name} onChange={(e) => handleName(e.target.value)} placeholder="Senior Teacher" />
            )}
          </FormField>

          <FormField label="Code" required error={fieldErrors.code?.[0]} description="Short unique reference">
            {(field) => <Input {...field} value={code} onChange={(e) => setCode(e.target.value)} />}
          </FormField>

          <FormField label="Department" description="Optional — leave blank for school-wide roles">
            {(field) => (
              <Select value={departmentId} onValueChange={setDepartmentId} disabled={departments.length === 0}>
                <SelectTrigger id={field.id}>
                  <SelectValue placeholder={departments.length === 0 ? "No departments yet" : "Any department"} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label="Level"
            error={fieldErrors.level?.[0]}
            description="Higher means more senior. Used for ordering and reporting — it grants no permissions."
          >
            {(field) => (
              <Input {...field} type="number" min={0} max={100} value={level} onChange={(e) => setLevel(e.target.value)} />
            )}
          </FormField>

          <FormField label="Description">
            {(field) => (
              <Textarea {...field} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
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
              {designation ? "Save changes" : "Create designation"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
