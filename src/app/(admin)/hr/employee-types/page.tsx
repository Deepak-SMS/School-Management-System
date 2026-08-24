import { EmployeeTypeManager } from "@/features/hr/employee-type-manager";

export default function EmployeeTypesPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Employee types</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Employment categories such as Permanent, Contract or Visiting Faculty. Configurable per school.
        </p>
      </div>
      <EmployeeTypeManager />
    </div>
  );
}
