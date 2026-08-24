"use client";

import { useState } from "react";
import { employeeService } from "@/services/hrService";
import type { EmployeeDetail } from "@/types/hr";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_STATUS_LABELS, type EmploymentStatus } from "@/lib/constants/hr";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

/**
 * Changes employment status rather than deleting the employee. Historical
 * records stay queryable for payroll, audit and legal reporting (spec §2.15).
 */
export function EmployeeDeactivateModal({
  employee,
  open,
  onClose,
  onChanged,
}: {
  employee: EmployeeDetail;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<string>("inactive");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await employeeService.deactivate(employee.id, status, reason || undefined);
      toast({ title: "Employment status updated", variant: "success" });
      onChanged();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't update the status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Change employment status">
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <Alert variant="info">
            The employee record is kept, not deleted — payroll history, documents and audit entries stay intact.
          </Alert>

          <FormField label="New status" required description={`Currently ${EMPLOYMENT_STATUS_LABELS[employee.employmentStatus as EmploymentStatus] ?? employee.employmentStatus}`}>
            {(field) => (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id={field.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {EMPLOYMENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Reason" description="Recorded in the audit log and on the activity timeline">
            {(field) => <Textarea {...field} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Update status
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
