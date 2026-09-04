"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
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
import { SALARY_COMPONENT_TYPES, SALARY_COMPONENT_TYPE_LABELS, CALCULATION_TYPES, CALCULATION_TYPE_LABELS } from "@/lib/constants/payroll";
import type { SalaryComponentRecord } from "@/types/payroll";
import type { ApiError } from "@/services/studentService";

export function SalaryComponentManager() {
  const can = useCan();
  const [rows, setRows] = useState<SalaryComponentRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<SalaryComponentRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SalaryComponentRecord | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/salary-components")
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
      const res = await fetch(`/api/salary-components/${deleting.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw body;
      toast({
        title: body.deactivated ? "Component deactivated" : "Component deleted",
        description: body.deactivated ? `${body.structuresUsingComponent} structure(s) already use it, so it was kept for history.` : undefined,
        variant: "success",
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the component", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load salary components." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={5} columns={6} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} component{rows.length === 1 ? "" : "s"}
        </p>
        {can("payroll", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add component
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No salary components yet"
          description="A component — Basic, HRA, PF — is a building block of every salary structure. Add one with the code BASIC first; percentage-based components resolve against it."
          action={can("payroll", "create") ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> Add component</Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Calculation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{row.code}</TableCell>
                <TableCell>
                  <Badge variant={row.componentType === "earning" ? "success" : "warning"}>
                    {SALARY_COMPONENT_TYPE_LABELS[row.componentType as keyof typeof SALARY_COMPONENT_TYPE_LABELS] ?? row.componentType}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {CALCULATION_TYPE_LABELS[row.calculationType as keyof typeof CALCULATION_TYPE_LABELS] ?? row.calculationType}
                  {row.calculationType === "fixed" && row.amount != null && ` · ₹${row.amount}`}
                  {row.calculationType === "percentage_of_basic" && row.percentage != null && ` · ${row.percentage}%`}
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "success" : "neutral"}>{row.status === "active" ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can("payroll", "edit") && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                    )}
                    {can("payroll", "delete") && (
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

      <SalaryComponentModal
        key={editing?.id ?? "new"}
        open={creating || Boolean(editing)}
        component={editing}
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
        title={`Remove ${deleting?.name ?? "this component"}?`}
        description="If any salary structure already includes this component, it will be deactivated instead of deleted so those structures stay intact."
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function SalaryComponentModal({
  open,
  component,
  onClose,
  onSaved,
}: {
  open: boolean;
  component: SalaryComponentRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(component?.name ?? "");
  const [code, setCode] = useState(component?.code ?? "");
  const [componentType, setComponentType] = useState<(typeof SALARY_COMPONENT_TYPES)[number]>(
    (component?.componentType as (typeof SALARY_COMPONENT_TYPES)[number]) ?? "earning",
  );
  const [calculationType, setCalculationType] = useState<(typeof CALCULATION_TYPES)[number]>(
    (component?.calculationType as (typeof CALCULATION_TYPES)[number]) ?? "fixed",
  );
  const [amount, setAmount] = useState(component?.amount != null ? String(component.amount) : "");
  const [percentage, setPercentage] = useState(component?.percentage != null ? String(component.percentage) : "");
  const [isTaxable, setIsTaxable] = useState(component?.isTaxable ?? true);
  const [isActive, setIsActive] = useState(component ? component.status === "active" : true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleName(value: string) {
    setName(value);
    if (!component) setCode(value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = {
        name,
        code,
        componentType,
        calculationType,
        amount: calculationType === "fixed" && amount ? Number(amount) : undefined,
        percentage: calculationType === "percentage_of_basic" && percentage ? Number(percentage) : undefined,
        isTaxable,
        status: isActive ? "active" : "inactive",
      };
      const res = await fetch(component ? `/api/salary-components/${component.id}` : "/api/salary-components", {
        method: component ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw body;
      toast({ title: component ? "Component updated" : "Component created", variant: "success" });
      onSaved();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the component.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={component ? `Edit ${component.name}` : "Add salary component"}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Name" required error={fieldErrors.name?.[0]}>
            {(field) => <Input {...field} value={name} onChange={(e) => handleName(e.target.value)} placeholder="Basic, HRA, PF..." />}
          </FormField>

          <FormField label="Code" required error={fieldErrors.code?.[0]} description='Use "BASIC" for the component percentage-based ones resolve against.'>
            {(field) => <Input {...field} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BASIC" />}
          </FormField>

          <FormField label="Type" required>
            {(field) => (
              <Select value={componentType} onValueChange={(v) => setComponentType(v as (typeof SALARY_COMPONENT_TYPES)[number])}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALARY_COMPONENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SALARY_COMPONENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Calculation" required>
            {(field) => (
              <Select value={calculationType} onValueChange={(v) => setCalculationType(v as (typeof CALCULATION_TYPES)[number])}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALCULATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t} disabled={t === "formula"}>
                      {CALCULATION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          {calculationType === "fixed" && (
            <FormField label="Default amount" description="A structure can override this per component.">
              {(field) => <Input {...field} type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="15000" />}
            </FormField>
          )}
          {calculationType === "percentage_of_basic" && (
            <FormField label="Default percentage of Basic">
              {(field) => <Input {...field} type="number" min={0} max={100} value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="40" />}
            </FormField>
          )}

          <FormField label="Taxable" description="Whether this component counts toward taxable income.">
            {() => <Switch checked={isTaxable} onCheckedChange={setIsTaxable} />}
          </FormField>

          <FormField label="Active" description="Inactive components are hidden from new structures but keep existing ones intact.">
            {() => <Switch checked={isActive} onCheckedChange={setIsActive} />}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              {component ? "Save changes" : "Create component"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
