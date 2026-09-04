"use client";

import { useState } from "react";
import Link from "next/link";
import { PlayCircle, CheckCircle2, Lock, Unlock, FileText, Download } from "lucide-react";
import { payrollPeriodService } from "@/services/payrollService";
import type { PayrollPeriodDetail as PayrollPeriodDetailType } from "@/types/payroll";
import { PAYROLL_PERIOD_STATUS_LABELS } from "@/lib/constants/payroll";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

function money(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PayrollPeriodDetailView({ period, onReload }: { period: PayrollPeriodDetailType; onReload: () => void }) {
  const can = useCan();
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<{ staffId: string; reason: string }[] | null>(null);
  const [reopening, setReopening] = useState(false);

  const canManage = can("payroll", "create");
  const canApprove = can("payroll", "approve");

  async function handleProcess() {
    setBusy(true);
    setSkipped(null);
    try {
      const result = await payrollPeriodService.process(period.id);
      toast({
        title: `Calculated pay for ${result.processedCount} employee${result.processedCount === 1 ? "" : "s"}`,
        description: result.skipped.length > 0 ? `${result.skipped.length} skipped — see below.` : undefined,
        variant: result.skipped.length > 0 ? "warning" : "success",
      });
      setSkipped(result.skipped);
      onReload();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't process payroll.", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    setBusy(true);
    try {
      await payrollPeriodService.approve(period.id);
      toast({ title: "Payroll approved", variant: "success" });
      onReload();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't approve payroll.", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function handleLock() {
    setBusy(true);
    try {
      await payrollPeriodService.lock(period.id);
      toast({ title: "Payroll locked", variant: "success" });
      onReload();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't lock payroll.", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateSlips() {
    setBusy(true);
    try {
      const result = await payrollPeriodService.generateSlips(period.id);
      toast({ title: `${result.generated} salary slip(s) generated`, description: result.alreadyExisted > 0 ? `${result.alreadyExisted} already existed.` : undefined, variant: "success" });
      onReload();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't generate salary slips.", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (period.status === "draft" || period.status === "processed") && (
          <Button size="sm" onClick={handleProcess} isLoading={busy}>
            <PlayCircle className="size-4" /> {period.entries.length > 0 ? "Reprocess payroll" : "Process payroll"}
          </Button>
        )}
        {canApprove && period.status === "processed" && period.entries.length > 0 && (
          <Button size="sm" variant="secondary" onClick={handleApprove} isLoading={busy}>
            <CheckCircle2 className="size-4" /> Approve
          </Button>
        )}
        {canApprove && period.status === "approved" && (
          <Button size="sm" variant="secondary" onClick={handleLock} isLoading={busy}>
            <Lock className="size-4" /> Lock period
          </Button>
        )}
        {canApprove && period.status === "locked" && (
          <>
            <Button size="sm" onClick={handleGenerateSlips} isLoading={busy}>
              <FileText className="size-4" /> Generate salary slips
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReopening(true)}>
              <Unlock className="size-4" /> Reopen
            </Button>
          </>
        )}
        <Badge variant={period.status === "locked" ? "success" : "neutral"} className="ml-auto">
          {PAYROLL_PERIOD_STATUS_LABELS[period.status as keyof typeof PAYROLL_PERIOD_STATUS_LABELS] ?? period.status}
        </Badge>
      </div>

      {period.reopenedAt && period.status !== "locked" && (
        <Alert variant="warning" title="This period was reopened">
          {period.reopenReason}
        </Alert>
      )}

      {skipped && skipped.length > 0 && (
        <Alert variant="warning" title={`${skipped.length} employee(s) skipped`}>
          {skipped.map((s) => s.reason).join("; ")}
        </Alert>
      )}

      {period.entries.length === 0 ? (
        <EmptyState title="No entries yet" description="Process payroll to calculate pay for every eligible employee." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Slip</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {period.entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{entry.staff.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {entry.staff.employeeId}
                    {entry.staff.designation ? ` · ${entry.staff.designation.name}` : ""}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.payableDays} / {entry.workingDays}
                </TableCell>
                <TableCell>₹{money(entry.grossSalary)}</TableCell>
                <TableCell className="text-danger-600">-₹{money(entry.totalDeductions)}</TableCell>
                <TableCell className="font-medium">₹{money(entry.netSalary)}</TableCell>
                <TableCell>
                  {entry.slipPdfUrl ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={entry.slipPdfUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="size-4" /> {entry.slip?.slipNumber}
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ReopenModal
        open={reopening}
        onClose={() => setReopening(false)}
        onReopened={() => {
          setReopening(false);
          onReload();
        }}
        periodId={period.id}
      />
    </div>
  );
}

function ReopenModal({ open, onClose, onReopened, periodId }: { open: boolean; onClose: () => void; onReopened: () => void; periodId: string }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setError("A reason is required to reopen a locked period.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await payrollPeriodService.reopen(periodId, { reason: reason.trim() });
      toast({ title: "Payroll period reopened", variant: "success" });
      onReopened();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't reopen the period.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Reopen this payroll period?">
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="text-sm text-muted-foreground">Salary slips already generated stay as they are — regenerating them is a separate step.</p>
          <FormField label="Reason" required>
            {(field) => <Textarea {...field} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Attendance correction for two employees" />}
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Reopen
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
