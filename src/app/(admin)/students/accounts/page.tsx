import { StudentAccountsTable } from "@/features/portal-access/student-accounts-table";

export default function StudentAccountsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Student Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant, reset, or revoke the portal logins students use to see their own attendance, timetable, and
          certificates.
        </p>
      </div>
      <StudentAccountsTable />
    </div>
  );
}
