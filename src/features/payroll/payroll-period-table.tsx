"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Calendar } from "lucide-react";
import { payrollPeriodService } from "@/services/payrollService";
import type { PayrollPeriodRecord } from "@/types/payroll";
import { PAYROLL_PERIOD_STATUS_LABELS } from "@/lib/constants/payroll";
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
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "primary"> = {
  draft: "neutral",
  processing: "warning",
  processed: "primary",
  approved: "primary",
  locked: "success",
};

export function PayrollPeriodTable() {
  const can = useCan();
  const [rows, setRows] = useState<PayrollPeriodRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);

  function load() {
    setError(false);
    payrollPeriodService.list().then((r) => setRows(r.data)).catch(() => setError(true));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, []);

  if (error) return <ErrorState description="Couldn't load payroll periods." onRetry={load} />;
  if (!rows) return <TableSkeleton rows={5} columns={5} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} period{rows.length === 1 ? "" : "s"}
        </p>
        {can("payroll", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New payroll period
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No payroll periods yet"
          description="Create a period for the month you want to run payroll for."
          action={can("payroll", "create") ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> New payroll period</Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {MONTH_NAMES[row.month - 1]} {row.year}
                </TableCell>
                <TableCell>{row.entryCount}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status] ?? "neutral"}>{PAYROLL_PERIOD_STATUS_LABELS[row.status as keyof typeof PAYROLL_PERIOD_STATUS_LABELS] ?? row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/hr/payroll/${row.id}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <NewPeriodModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          load();
        }}
      />
    </div>
  );
}

function NewPeriodModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await payrollPeriodService.create({ year: Number(year), month: Number(month) });
      toast({ title: "Payroll period created", variant: "success" });
      onCreated();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't create the period.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="New payroll period">
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Month" required>
              {(field) => (
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger id={field.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Year" required>
              {(field) => <Input {...field} type="number" value={year} onChange={(e) => setYear(e.target.value)} />}
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Create period
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
