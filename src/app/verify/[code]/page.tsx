import { CheckCircle2, XCircle } from "lucide-react";
import { findByVerificationCode } from "@/lib/qr-verification";

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const record = await findByVerificationCode(code);

  if (!record || !record.isActive) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
          <XCircle className="size-10 text-danger-500" />
          <p className="text-lg font-semibold text-foreground">Card not valid</p>
          <p className="text-sm text-muted-foreground">
            This verification code doesn&apos;t match an active ID card. It may have been lost, blocked, or replaced.
          </p>
        </div>
      </div>
    );
  }

  const person = record.student ?? record.staff;
  const visibleFields: string[] = record.visibleFieldsJson ? JSON.parse(record.visibleFieldsJson) : [];

  const rows: { label: string; value: string }[] = [];
  if (record.student) {
    if (visibleFields.includes("name")) rows.push({ label: "Name", value: `${record.student.firstName} ${record.student.lastName}` });
    if (visibleFields.includes("admissionNumber")) rows.push({ label: "Admission No", value: record.student.admissionNumber });
    if (visibleFields.includes("status")) rows.push({ label: "Status", value: record.student.status });
  } else if (record.staff) {
    if (visibleFields.includes("name")) rows.push({ label: "Name", value: record.staff.fullName });
    if (visibleFields.includes("employeeId")) rows.push({ label: "Employee ID", value: record.staff.employeeId });
    if (visibleFields.includes("designation")) rows.push({ label: "Designation", value: record.staff.designation?.name ?? "" });
    if (visibleFields.includes("status")) rows.push({ label: "Status", value: record.staff.employmentStatus });
  }
  rows.push({ label: "School", value: record.school.name });

  if (!person) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
          <XCircle className="size-10 text-danger-500" />
          <p className="text-lg font-semibold text-foreground">Card not valid</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        <CheckCircle2 className="size-10 text-accent-600" />
        <p className="text-lg font-semibold text-foreground">Verified</p>
        <dl className="w-full divide-y divide-border text-left text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between py-2">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
