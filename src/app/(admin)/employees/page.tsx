import { StaffTable } from "@/features/staff/staff-table";

export default function EmployeesPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">Teachers and non-teaching staff across your school.</p>
      </div>
      <StaffTable />
    </div>
  );
}
