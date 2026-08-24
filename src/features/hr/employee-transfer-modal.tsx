"use client";

import { useEffect, useState } from "react";
import { employeeService, hrLookupService } from "@/services/hrService";
import type { EmployeeDetail, HrLookups } from "@/types/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

/**
 * Transfers change department/designation/campus/manager/location while keeping
 * the previous values — the API writes an immutable StaffTransfer row before
 * updating the employee, so history is never silently overwritten.
 */
export function EmployeeTransferModal({
  employee,
  open,
  onClose,
  onTransferred,
}: {
  employee: EmployeeDetail;
  open: boolean;
  onClose: () => void;
  onTransferred: () => void;
}) {
  const [lookups, setLookups] = useState<HrLookups | null>(null);
  const [toDepartmentId, setToDepartmentId] = useState("");
  const [toDesignationId, setToDesignationId] = useState("");
  const [toCampusId, setToCampusId] = useState("");
  const [toManagerId, setToManagerId] = useState("");
  const [toWorkLocation, setToWorkLocation] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !lookups) hrLookupService.all().then(setLookups).catch(() => setError("Couldn't load options."));
  }, [open, lookups]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await employeeService.transfer(employee.id, {
        toDepartmentId: toDepartmentId || undefined,
        toDesignationId: toDesignationId || undefined,
        toCampusId: toCampusId || undefined,
        toManagerId: toManagerId || undefined,
        toWorkLocation: toWorkLocation || undefined,
        reason: reason || undefined,
        effectiveDate,
      });
      toast({ title: "Transfer recorded", variant: "success" });
      onTransferred();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't record the transfer.");
    } finally {
      setBusy(false);
    }
  }

  const managers = (lookups?.managers ?? []).filter((m) => m.id !== employee.id);

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title="Transfer employee"
        description="Leave a field blank to keep it unchanged. The current value is shown beneath each option."
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <PickerField
            label="Department"
            current={employee.department?.name}
            value={toDepartmentId}
            onChange={setToDepartmentId}
            options={(lookups?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
          <PickerField
            label="Designation"
            current={employee.designation}
            value={toDesignationId}
            onChange={setToDesignationId}
            options={(lookups?.designations ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
          <PickerField
            label="Campus"
            current={employee.campus?.name}
            value={toCampusId}
            onChange={setToCampusId}
            options={(lookups?.campuses ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <PickerField
            label="Reporting manager"
            current={employee.reportingManager?.fullName}
            value={toManagerId}
            onChange={setToManagerId}
            options={managers.map((m) => ({ value: m.id, label: `${m.fullName} (${m.employeeId})` }))}
          />

          <FormField label="Work location" description={employee.workLocation ? `Currently ${employee.workLocation}` : undefined}>
            {(field) => (
              <Input {...field} value={toWorkLocation} onChange={(e) => setToWorkLocation(e.target.value)} />
            )}
          </FormField>

          <FormField label="Effective date" required>
            {(field) => (
              <Input {...field} type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            )}
          </FormField>

          <FormField label="Reason" description="Recorded on the employee's activity timeline">
            {(field) => <Textarea {...field} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Record transfer
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function PickerField({
  label,
  current,
  value,
  onChange,
  options,
}: {
  label: string;
  current?: string | null;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <FormField label={label} description={current ? `Currently ${current}` : "Not set"}>
      {(field) => (
        <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
          <SelectTrigger id={field.id}>
            <SelectValue placeholder={options.length === 0 ? "None available" : "No change"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}
