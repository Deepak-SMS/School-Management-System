"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { staffService } from "@/services/staffService";
import { salaryAssignmentService } from "@/services/payrollService";
import { useCan } from "@/hooks/use-can";
import type { SalaryStructureRecord } from "@/types/payroll";
import type { StaffRecord } from "@/types/staff";
import { SALARY_COMPONENT_TYPE_LABELS } from "@/lib/constants/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

export function SalaryStructureDetail({ structure, onReload }: { structure: SalaryStructureRecord; onReload: () => void }) {
  const can = useCan();
  const [assigning, setAssigning] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount / Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {structure.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.component.name}</TableCell>
                  <TableCell>
                    <Badge variant={item.component.componentType === "earning" ? "success" : "warning"}>
                      {SALARY_COMPONENT_TYPE_LABELS[item.component.componentType as keyof typeof SALARY_COMPONENT_TYPE_LABELS]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.component.calculationType === "percentage_of_basic"
                      ? `${item.percentage ?? item.component.percentage ?? 0}% of Basic`
                      : `₹${item.amount ?? item.component.amount ?? 0}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Assigned staff ({structure.assignments?.length ?? 0})</CardTitle>
          {can("payroll", "edit") && (
            <Button size="sm" onClick={() => setAssigning(true)}>
              <UserPlus className="size-4" /> Assign staff
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!structure.assignments || structure.assignments.length === 0 ? (
            <EmptyState title="No one is on this structure yet" description="Assign staff to start including them in payroll runs." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structure.assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.staff.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{a.staff.employeeId}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(a.effectiveFrom).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AssignStaffModal
        open={assigning}
        structureId={structure.id}
        onClose={() => setAssigning(false)}
        onAssigned={() => {
          setAssigning(false);
          onReload();
        }}
      />
    </div>
  );
}

function AssignStaffModal({
  open,
  structureId,
  onClose,
  onAssigned,
}: {
  open: boolean;
  structureId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [staffId, setStaffId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      staffService.list({ q: search || undefined, pageSize: 20 }).then((r) => setStaff(r.data)).catch(() => setStaff([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [open, search]);

  async function submit() {
    if (!staffId) {
      setError("Pick a staff member first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await salaryAssignmentService.assign(staffId, { structureId, effectiveFrom });
      toast({ title: "Salary structure assigned", variant: "success" });
      setStaffId("");
      setSearch("");
      onAssigned();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't assign the structure.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Assign staff to this structure">
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Employee" required>
            {(field) => (
              <div className="flex flex-col gap-2">
                <Input id={field.id} placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <Select value={staffId || "none"} onValueChange={(v) => setStaffId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select employee</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName} ({s.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </FormField>

          <FormField label="Effective from" required>
            {(field) => <Input {...field} type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Assign
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
