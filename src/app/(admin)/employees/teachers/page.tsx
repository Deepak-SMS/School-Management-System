import { Suspense } from "react";
import { EmployeeTable } from "@/features/hr/employee-table";
import { LoadingState } from "@/components/ui/loading-state";

export default function TeachersPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Teaching staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">Teachers only — a filtered view of the same employee records.</p>
      </div>
      <Suspense fallback={<LoadingState />}>
        <EmployeeTable fixedCategory="teacher" />
      </Suspense>
    </div>
  );
}
