"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Pencil, ArrowLeftRight, UserMinus, X } from "lucide-react";
import { employeeService } from "@/services/hrService";
import type { EmployeeDetail } from "@/types/hr";
import type { StaffInput } from "@/lib/validation/staff";
import { STAFF_CATEGORY_LABELS } from "@/lib/constants/people";
import { EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_STATUS_TONES, type EmploymentStatus } from "@/lib/constants/hr";
import { EmployeeForm } from "@/features/hr/employee-form";
import { EmployeeProfile } from "@/features/hr/employee-profile";
import { EmployeeTransferModal } from "@/features/hr/employee-transfer-modal";
import { EmployeeDeactivateModal } from "@/features/hr/employee-deactivate-modal";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const load = useCallback(() => {
    setError(false);
    employeeService
      .get(id)
      .then(setEmployee)
      .catch(() => setError(true));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <ErrorState className="mx-auto max-w-5xl px-6 py-16" onRetry={load} />;
  if (!employee) return <LoadingState className="mx-auto max-w-5xl px-6 py-16" />;

  const status = employee.employmentStatus as EmploymentStatus;
  const initials = employee.fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <Link
        href="/employees"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to employees
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar initials={initials} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-foreground">{employee.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {employee.employeeId} ·{" "}
            {STAFF_CATEGORY_LABELS[employee.category as keyof typeof STAFF_CATEGORY_LABELS] ?? employee.category}
            {employee.designation ? ` · ${employee.designation}` : ""}
          </p>
        </div>

        <Badge variant={EMPLOYMENT_STATUS_TONES[status] ?? "neutral"}>
          {EMPLOYMENT_STATUS_LABELS[status] ?? employee.employmentStatus}
        </Badge>

        <div className="flex flex-wrap gap-2">
          {can("employees", "edit") && (
            <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? (
                <>
                  <X className="size-4" /> Cancel
                </>
              ) : (
                <>
                  <Pencil className="size-4" /> Edit
                </>
              )}
            </Button>
          )}
          {can("employees", "transfer") && (
            <Button variant="secondary" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight className="size-4" /> Transfer
            </Button>
          )}
          {can("employees", "deactivate") && (
            <Button variant="secondary" onClick={() => setDeactivateOpen(true)}>
              <UserMinus className="size-4" /> Change status
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <EmployeeForm
          mode="edit"
          submitLabel="Save changes"
          currentEmployeeId={employee.id}
          defaultValues={toFormValues(employee)}
          onSubmit={async (input) => {
            await employeeService.update(id, input);
            toast({ title: "Employee updated", variant: "success" });
            setEditing(false);
            load();
          }}
        />
      ) : (
        <>
          <EmployeeProfile employee={employee} onChanged={load} />

          {employee.qrVerification && (
            <Card>
              <CardHeader>
                <CardTitle>Verification identifier</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3 text-sm">
                <ShieldCheck className="size-5 shrink-0 text-accent-600" aria-hidden="true" />
                <div>
                  <p className="font-mono font-medium text-foreground">VERIFY-{employee.qrVerification.code}</p>
                  <p className="text-muted-foreground">
                    Generated automatically — this is what the ID card&apos;s QR code encodes once cards are generated.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <EmployeeTransferModal
        employee={employee}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onTransferred={() => {
          setTransferOpen(false);
          load();
        }}
      />

      <EmployeeDeactivateModal
        employee={employee}
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onChanged={() => {
          setDeactivateOpen(false);
          load();
        }}
      />
    </div>
  );
}

/** Maps the API record onto the form's field names, trimming ISO dates to `yyyy-mm-dd`. */
function toFormValues(employee: EmployeeDetail): Partial<StaffInput> {
  return {
    employeeId: employee.employeeId,
    firstName: employee.firstName ?? employee.fullName.split(" ")[0] ?? "",
    middleName: employee.middleName ?? undefined,
    lastName: employee.lastName ?? (employee.fullName.split(" ").slice(1).join(" ") || undefined),
    preferredName: employee.preferredName ?? undefined,
    dateOfBirth: employee.dateOfBirth?.slice(0, 10),
    gender: employee.gender as StaffInput["gender"],
    bloodGroup: employee.bloodGroup as StaffInput["bloodGroup"],
    maritalStatus: employee.maritalStatus as StaffInput["maritalStatus"],
    mobileNumber: employee.mobileNumber,
    alternateNumber: employee.alternateNumber ?? undefined,
    email: employee.email ?? undefined,
    officialEmail: employee.officialEmail ?? undefined,
    address: employee.address ?? undefined,
    permanentAddress: employee.permanentAddress ?? undefined,
    city: employee.city ?? undefined,
    state: employee.state ?? undefined,
    country: employee.country ?? undefined,
    pinCode: employee.pinCode ?? undefined,
    emergencyName: employee.emergencyName ?? undefined,
    emergencyRelation: employee.emergencyRelation ?? undefined,
    emergencyContact: employee.emergencyContact ?? undefined,
    emergencyAddress: employee.emergencyAddress ?? undefined,
    category: employee.category as StaffInput["category"],
    designationId: employee.designationId ?? undefined,
    departmentId: employee.departmentId ?? undefined,
    campusId: employee.campusId ?? undefined,
    employeeTypeId: employee.employeeTypeId ?? undefined,
    reportingManagerId: employee.reportingManagerId ?? undefined,
    workLocation: employee.workLocation ?? undefined,
    joiningDate: employee.joiningDate?.slice(0, 10),
    confirmationDate: employee.confirmationDate?.slice(0, 10),
    probationEndDate: employee.probationEndDate?.slice(0, 10),
    probationMonths: employee.probationMonths ?? undefined,
    employmentStatus: employee.employmentStatus as StaffInput["employmentStatus"],
    // Present only when the caller may see them; otherwise the server stripped them.
    panNumber: employee.panNumber ?? undefined,
    bankName: employee.bankName ?? undefined,
    bankAccountNumber: employee.bankAccountNumber ?? undefined,
    bankIfsc: employee.bankIfsc ?? undefined,
    bankAccountHolder: employee.bankAccountHolder ?? undefined,
    pfNumber: employee.pfNumber ?? undefined,
    esicNumber: employee.esicNumber ?? undefined,
  };
}
