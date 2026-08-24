import { Suspense } from "react";
import { EmployeeTable } from "@/features/hr/employee-table";
import { LoadingState } from "@/components/ui/loading-state";

export default function EmployeesPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teaching and non-teaching staff across your school. One record per person, shared by every HR module.
        </p>
      </div>
      {/* EmployeeTable reads filters from the URL, so it needs a Suspense boundary. */}
      <Suspense fallback={<LoadingState />}>
        <EmployeeTable />
      </Suspense>
    </div>
  );
}
