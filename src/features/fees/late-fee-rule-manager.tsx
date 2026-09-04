"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { lateFeeRuleService } from "@/services/feeStructureService";
import type { LateFeeRuleRecord } from "@/types/fees";
import { LATE_FEE_CALCULATION_TYPES, LATE_FEE_CALCULATION_LABELS } from "@/lib/constants/fees";
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

function describeValue(row: LateFeeRuleRecord): string {
  const isPercentage = row.calculationType.endsWith("percentage");
  const value = isPercentage ? `${row.percentage ?? 0}%` : `₹${(row.amount ?? 0).toLocaleString("en-IN")}`;
  const perDay = row.calculationType.startsWith("per_day") ? " / day late" : "";
  return `${value}${perDay}`;
}

export function LateFeeRuleManager() {
  const can = useCan();
  const [rows, setRows] = useState<LateFeeRuleRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LateFeeRuleRecord | null>(null);
  const [deleting, setDeleting] = useState<LateFeeRuleRecord | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    lateFeeRuleService
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
      const result = await lateFeeRuleService.remove(deleting.id);
      toast({
        title: result.deactivated ? "Late fee rule deactivated" : "Late fee rule deleted",
        description: result.deactivated
          ? `${result.items} fee structure item${result.items === 1 ? "" : "s"} still use it, so it was kept for history.`
          : undefined,
        variant: "success",
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the late fee rule", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load late fee rules." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={4} columns={5} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} late fee rule{rows.length === 1 ? "" : "s"}
        </p>
        {can("lateFeeRules", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add late fee rule
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No late fee rules yet"
          description="Add a penalty rule — a fixed amount, a percentage, or a per-day charge — to attach to fee items with a due date."
          action={
            can("lateFeeRules", "create") ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add late fee rule
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Grace days</TableHead>
              <TableHead>Cap</TableHead>
              <TableHead>Used by</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {(LATE_FEE_CALCULATION_LABELS as Record<string, string>)[row.calculationType] ?? row.calculationType}
                </TableCell>
                <TableCell>{describeValue(row)}</TableCell>
                <TableCell>{row.graceDays}</TableCell>
                <TableCell>{row.maxAmount ? `₹${row.maxAmount.toLocaleString("en-IN")}` : "—"}</TableCell>
                <TableCell className="tabular-nums">{row.counts?.items ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "success" : "neutral"}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can("lateFeeRules", "edit") && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                    )}
                    {can("lateFeeRules", "delete") && (
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

      <LateFeeRuleModal
        key={editing?.id ?? "new"}
        open={creating || Boolean(editing)}
        rule={editing}
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
        title={`Remove ${deleting?.name ?? "late fee rule"}?`}
        description={
          (deleting?.counts?.items ?? 0) > 0
            ? `${deleting?.counts?.items} fee structure item(s) use this rule, so it will be deactivated rather than deleted.`
            : "This late fee rule isn't in use and will be deleted permanently."
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function LateFeeRuleModal({
  open,
  rule,
  onClose,
  onSaved,
}: {
  open: boolean;
  rule: LateFeeRuleRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [calculationType, setCalculationType] = useState(rule?.calculationType ?? "fixed");
  const [amount, setAmount] = useState(rule?.amount != null ? String(rule.amount) : "");
  const [percentage, setPercentage] = useState(rule?.percentage != null ? String(rule.percentage) : "");
  const [graceDays, setGraceDays] = useState(String(rule?.graceDays ?? 0));
  const [maxAmount, setMaxAmount] = useState(rule?.maxAmount != null ? String(rule.maxAmount) : "");
  const [status, setStatus] = useState(rule?.status ?? "active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const isPercentageType = calculationType.endsWith("percentage");

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = {
        name,
        calculationType: calculationType as (typeof LATE_FEE_CALCULATION_TYPES)[number],
        amount: isPercentageType ? undefined : Number(amount) || undefined,
        percentage: isPercentageType ? Number(percentage) || undefined : undefined,
        graceDays: Number(graceDays) || 0,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
        status: status as "active" | "inactive",
      };
      if (rule) await lateFeeRuleService.update(rule.id, payload);
      else await lateFeeRuleService.create(payload);

      toast({ title: rule ? "Late fee rule updated" : "Late fee rule created", variant: "success" });
      onSaved();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the late fee rule.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={rule ? `Edit ${rule.name}` : "Add late fee rule"}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Name" required error={fieldErrors.name?.[0]}>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard late fee" />}
          </FormField>

          <FormField label="Calculation type">
            {(field) => (
              <Select value={calculationType} onValueChange={setCalculationType}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LATE_FEE_CALCULATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LATE_FEE_CALCULATION_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          {isPercentageType ? (
            <FormField label="Percentage" required error={fieldErrors.percentage?.[0]} description="Percent of the overdue amount">
              {(field) => (
                <Input {...field} type="number" min={0} max={100} step="0.01" value={percentage} onChange={(e) => setPercentage(e.target.value)} />
              )}
            </FormField>
          ) : (
            <FormField label="Amount" required error={fieldErrors.amount?.[0]}>
              {(field) => <Input {...field} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
            </FormField>
          )}

          <FormField label="Grace days" description="Days after the due date before the penalty starts">
            {(field) => <Input {...field} type="number" min={0} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />}
          </FormField>

          <FormField label="Maximum amount" description="Optional cap, useful for per-day rules">
            {(field) => <Input {...field} type="number" min={0} step="0.01" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />}
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
              {rule ? "Save changes" : "Create late fee rule"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
