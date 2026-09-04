import { GuardianAccountsTable } from "@/features/portal-access/guardian-accounts-table";

export default function ParentAccountsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Parent Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant, reset, or revoke the portal logins parents use to see their children&apos;s attendance, timetable,
          and fees — and control which children each login can see.
        </p>
      </div>
      <GuardianAccountsTable />
    </div>
  );
}
