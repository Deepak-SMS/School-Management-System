"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
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
import { PAYROLL_RULE_TYPES, PAYROLL_RULE_TYPE_LABELS, EMPLOYEE_GROUPS, EMPLOYEE_GROUP_LABELS } from "@/lib/constants/payroll";
import type { PayrollRuleRecord } from "@/types/payroll";
import type { ApiError } from "@/services/studentService";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function PayrollRuleManager() {
  const can = useCan();
  const [rows, setRows] = useState<PayrollRuleRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<PayrollRuleRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PayrollRuleRecord | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payroll-rules")
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
      const res = await fetch(`/api/payroll-rules/${deleting.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw body;
      toast({ title: "Rule deleted", variant: "success" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the rule", variant: "danger" });
    }
  }

  if (error) return <ErrorState description="Couldn't load payroll rules." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={5} columns={6} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} rule{rows.length === 1 ? "" : "s"}
        </p>
        {can("payroll", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add rule
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No payroll rules yet"
          description="PF, ESI, Professional Tax and TDS rates — configured here, versioned by effective date, never hardcoded."
          action={can("payroll", "create") ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> Add rule</Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Effective from</TableHead>
              <TableHead>Employee contribution</TableHead>
              <TableHead>Applies to</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{PAYROLL_RULE_TYPE_LABELS[row.ruleType as keyof typeof PAYROLL_RULE_TYPE_LABELS] ?? row.ruleType}</TableCell>
                <TableCell>{formatDate(row.effectiveDate)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.employeeContributionPercent != null ? `${row.employeeContributionPercent}%` : row.rate != null ? `₹${row.rate}` : "—"}
                  {row.thresholdAmount != null && ` (up to ₹${row.thresholdAmount})`}
                </TableCell>
                <TableCell className="text-muted-foreground">{EMPLOYEE_GROUP_LABELS[row.applicableEmployeeGroup as keyof typeof EMPLOYEE_GROUP_LABELS] ?? row.applicableEmployeeGroup}</TableCell>
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

      <PayrollRuleModal
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
        title={`Remove this ${deleting ? (PAYROLL_RULE_TYPE_LABELS[deleting.ruleType as keyof typeof PAYROLL_RULE_TYPE_LABELS] ?? deleting.ruleType) : "rule"}?`}
        description="This can't be undone. Payroll periods already processed with this rule keep their calculated figures."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function PayrollRuleModal({
  open,
  rule,
  onClose,
  onSaved,
}: {
  open: boolean;
  rule: PayrollRuleRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ruleType, setRuleType] = useState<(typeof PAYROLL_RULE_TYPES)[number]>((rule?.ruleType as (typeof PAYROLL_RULE_TYPES)[number]) ?? "pf");
  const [effectiveDate, setEffectiveDate] = useState(rule?.effectiveDate?.slice(0, 10) ?? "");
  const [employeeContributionPercent, setEmployeeContributionPercent] = useState(rule?.employeeContributionPercent != null ? String(rule.employeeContributionPercent) : "");
  const [rate, setRate] = useState(rule?.rate != null ? String(rule.rate) : "");
  const [thresholdAmount, setThresholdAmount] = useState(rule?.thresholdAmount != null ? String(rule.thresholdAmount) : "");
  const [applicableEmployeeGroup, setApplicableEmployeeGroup] = useState<(typeof EMPLOYEE_GROUPS)[number]>(
    (rule?.applicableEmployeeGroup as (typeof EMPLOYEE_GROUPS)[number]) ?? "all",
  );
  const [isActive, setIsActive] = useState(rule ? rule.status === "active" : true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = {
        ruleType,
        effectiveDate,
        employeeContributionPercent: employeeContributionPercent ? Number(employeeContributionPercent) : undefined,
        rate: rate ? Number(rate) : undefined,
        thresholdAmount: thresholdAmount ? Number(thresholdAmount) : undefined,
        applicableEmployeeGroup,
        status: isActive ? "active" : "inactive",
      };
      const res = await fetch(rule ? `/api/payroll-rules/${rule.id}` : "/api/payroll-rules", {
        method: rule ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw body;
      toast({ title: rule ? "Rule updated" : "Rule created", variant: "success" });
      onSaved();
    } catch (e) {
      const apiError = e as ApiError;
      setError(apiError?.error ?? "Couldn't save the rule.");
      setFieldErrors((apiError?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={rule ? `Edit ${PAYROLL_RULE_TYPE_LABELS[rule.ruleType as keyof typeof PAYROLL_RULE_TYPE_LABELS]}` : "Add payroll rule"}>
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Rule" required>
            {(field) => (
              <Select value={ruleType} onValueChange={(v) => setRuleType(v as (typeof PAYROLL_RULE_TYPES)[number])}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYROLL_RULE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PAYROLL_RULE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Effective from" required error={fieldErrors.effectiveDate?.[0]}>
            {(field) => <Input {...field} type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />}
          </FormField>

          <FormField label="Employee contribution (%)" description="Percentage of the pro-rated gross salary for this period.">
            {(field) => <Input {...field} type="number" min={0} max={100} value={employeeContributionPercent} onChange={(e) => setEmployeeContributionPercent(e.target.value)} placeholder="12" />}
          </FormField>

          <FormField label="Or a flat amount" description="Used only when no percentage is set above.">
            {(field) => <Input {...field} type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="200" />}
          </FormField>

          <FormField label="Salary threshold" description="Rule applies only up to this gross salary, if set.">
            {(field) => <Input {...field} type="number" min={0} value={thresholdAmount} onChange={(e) => setThresholdAmount(e.target.value)} placeholder="21000" />}
          </FormField>

          <FormField label="Applies to" required>
            {(field) => (
              <Select value={applicableEmployeeGroup} onValueChange={(v) => setApplicableEmployeeGroup(v as (typeof EMPLOYEE_GROUPS)[number])}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {EMPLOYEE_GROUP_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Active" description="Inactive rules are ignored by future payroll runs.">
            {() => <Switch checked={isActive} onCheckedChange={setIsActive} />}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              {rule ? "Save changes" : "Create rule"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
