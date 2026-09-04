import { CheckCircle2, XCircle } from "lucide-react";
import { findCertificateByVerificationCode } from "@/lib/certificates/verification";

/** Public, unauthenticated certificate verification — kept at its own path (not `/verify/[code]`) so certificate and ID card codes never collide. */
export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const record = await findCertificateByVerificationCode(code);

  const certificate = record?.certificate;
  // `isActive` is the code's own lifecycle (retired on reissue) — a revoked
  // certificate must still resolve here so the page can say "Revoked" with
  // details, not pretend the code never existed.
  const invalid = !record || !record.isActive || !certificate;

  if (invalid) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
          <XCircle className="size-10 text-danger-500" />
          <p className="text-lg font-semibold text-foreground">Certificate not valid</p>
          <p className="text-sm text-muted-foreground">
            This verification code doesn&apos;t match a certificate on record. It may have been reissued under a new code.
          </p>
        </div>
      </div>
    );
  }

  const person = certificate.student ?? certificate.staff;
  const visibleFields: string[] = record.visibleFieldsJson ? JSON.parse(record.visibleFieldsJson) : [];
  const personName = certificate.student
    ? [certificate.student.firstName, certificate.student.lastName].filter(Boolean).join(" ")
    : certificate.staff?.fullName;

  const rows: { label: string; value: string }[] = [];
  if (visibleFields.includes("certificateNumber")) rows.push({ label: "Certificate No.", value: certificate.certificateNumber });
  if (visibleFields.includes("name") && personName) rows.push({ label: "Name", value: personName });
  if (visibleFields.includes("certificateType")) rows.push({ label: "Certificate Type", value: certificate.certificateType.name });
  if (visibleFields.includes("school")) rows.push({ label: "School", value: record.school.name });
  if (visibleFields.includes("issueDate")) {
    rows.push({ label: "Issue Date", value: new Date(certificate.issueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) });
  }
  if (visibleFields.includes("status")) rows.push({ label: "Status", value: certificate.status === "revoked" ? "Revoked" : "Valid" });

  if (!person) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
          <XCircle className="size-10 text-danger-500" />
          <p className="text-lg font-semibold text-foreground">Certificate not valid</p>
        </div>
      </div>
    );
  }

  const isRevoked = certificate.status === "revoked";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        {isRevoked ? <XCircle className="size-10 text-danger-500" /> : <CheckCircle2 className="size-10 text-accent-600" />}
        <p className="text-lg font-semibold text-foreground">{isRevoked ? "Revoked" : "Verified"}</p>
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
