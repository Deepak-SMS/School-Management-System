import { StaffTable } from "@/features/staff/staff-table";

export default function TeachersPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Teachers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Teaching staff only — a filtered view of Employees.</p>
      </div>
      <StaffTable fixedCategory="teacher" />
    </div>
  );
}
