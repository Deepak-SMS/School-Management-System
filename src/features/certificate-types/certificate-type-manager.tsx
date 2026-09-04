"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ScrollText, FilePlus2, LayoutTemplate } from "lucide-react";
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
import type { ApiError } from "@/services/studentService";

interface CertificateType {
  id: string;
  key: string;
  name: string;
  category: "student" | "staff";
  numberingPrefix: string;
  requiresApproval: boolean;
  isSystemType: boolean;
  isActive: boolean;
}

export function CertificateTypeManager() {
  const can = useCan();
  const [rows, setRows] = useState<CertificateType[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<CertificateType | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CertificateType | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  /** Starter types are shared across every school — Edit never mutates them directly. It clones a school-owned copy first, then opens that copy for editing. */
  async function handleEditClick(row: CertificateType) {
    if (!row.isSystemType) {
      setEditing(row);
      return;
    }
    setDuplicatingId(row.id);
    try {
      const res = await fetch(`/api/certificate-types/${row.id}/duplicate`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw body;
      toast({ title: "Created your own copy", description: `${body.name} — edit it freely.`, variant: "success" });
      load();
      setEditing(body);
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't duplicate the certificate type", variant: "danger" });
    } finally {
      setDuplicatingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/certificate-types")
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
      const res = await fetch(`/api/certificate-types/${deleting.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw body;
      toast({
        title: body.deactivated ? "Certificate type deactivated" : "Certificate type deleted",
        description: body.deactivated ? `${body.certificatesIssued} certificate(s) already reference it, so it was kept for history.` : undefined,
        variant: "success",
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the certificate type", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load certificate types." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={5} columns={5} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} certificate type{rows.length === 1 ? "" : "s"}
        </p>
        {can("certificateTypes", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add certificate type
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No certificate types yet"
          description="A certificate type controls its numbering prefix and whether it needs approval before issue."
          action={can("certificateTypes", "create") ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> Add certificate type</Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Numbering Prefix</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.name}
                  {row.isSystemType && <Badge variant="neutral" className="ml-2">Starter</Badge>}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">{row.category}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{row.numberingPrefix}</TableCell>
                <TableCell>
                  <Badge variant={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can("certificates", "create") && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/certificates/generate?certificateTypeId=${row.id}&category=${row.category}`}>
                          <FilePlus2 className="size-4" /> Generate
                        </Link>
                      </Button>
                    )}
                    {can("certificateTypes", "edit") && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/certificates/designer?certificateTypeId=${row.id}`}>
                          <LayoutTemplate className="size-4" /> Set Template
                        </Link>
                      </Button>
                    )}
                    {can("certificateTypes", "edit") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(row)}
                        isLoading={duplicatingId === row.id}
                        title={row.isSystemType ? "Starter types can't be changed directly — this makes your own editable copy" : undefined}
                      >
                        <Pencil className="size-4" /> Edit
                      </Button>
                    )}
                    {can("certificateTypes", "delete") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(row)}
                        disabled={row.isSystemType}
                        title={row.isSystemType ? "Starter certificate types can't be removed" : undefined}
                      >
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

      <CertificateTypeModal
        key={editing?.id ?? "new"}
        open={creating || Boolean(editing)}
        certificateType={editing}
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
        title={`Remove ${deleting?.name ?? "certificate type"}?`}
        description="If certificates have already been issued under this type, it will be deactivated instead of deleted so their history stays intact."
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function CertificateTypeModal({
  open,
  certificateType,
  onClose,
  onSaved,
}: {
  open: boolean;
  certificateType: CertificateType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(certificateType?.name ?? "");
  const [key, setKey] = useState(certificateType?.key ?? "");
  const [category, setCategory] = useState<"student" | "staff">(certificateType?.category ?? "student");
  const [numberingPrefix, setNumberingPrefix] = useState(certificateType?.numberingPrefix ?? "");
  const [requiresApproval, setRequiresApproval] = useState(certificateType?.requiresApproval ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleName(value: string) {
    setName(value);
    if (!certificateType) setKey(value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = { name, key, category, numberingPrefix, requiresApproval };
      const res = await fetch(certificateType ? `/api/certificate-types/${certificateType.id}` : "/api/certificate-types", {
        method: certificateType ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw body;
      toast({ title: certificateType ? "Certificate type updated" : "Certificate type created", variant: "success" });
      onSaved();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the certificate type.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={certificateType ? `Edit ${certificateType.name}` : "Add certificate type"}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Name" required error={fieldErrors.name?.[0]}>
            {(field) => <Input {...field} value={name} onChange={(e) => handleName(e.target.value)} placeholder="Transfer Certificate" />}
          </FormField>

          <FormField label="Key" required error={fieldErrors.key?.[0]} description="Stable internal identifier, not shown to users">
            {(field) => <Input {...field} value={key} onChange={(e) => setKey(e.target.value)} disabled={Boolean(certificateType)} />}
          </FormField>

          <FormField label="Category" required>
            {(field) => (
              <Select value={category} onValueChange={(v) => setCategory(v as "student" | "staff")} disabled={Boolean(certificateType)}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Numbering prefix" required error={fieldErrors.numberingPrefix?.[0]} description={`Appears in the certificate number, e.g. ${numberingPrefix || "TC"}/2026/00045`}>
            {(field) => <Input {...field} value={numberingPrefix} onChange={(e) => setNumberingPrefix(e.target.value.toUpperCase())} placeholder="TC" />}
          </FormField>

          <FormField label="Requires approval" description="Certificates of this type must be approved before they're issued (coming soon — generation is direct for now)">
            {() => <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              {certificateType ? "Save changes" : "Create certificate type"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
