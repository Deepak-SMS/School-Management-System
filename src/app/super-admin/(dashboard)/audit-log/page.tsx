import { AuditLogTable } from "@/features/platform/audit-log/audit-log-table";

export default function PlatformAuditLogPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every action taken from the Super Admin console.</p>
      </div>
      <AuditLogTable />
    </div>
  );
}
