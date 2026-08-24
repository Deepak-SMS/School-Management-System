"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmployeeForm } from "@/features/hr/employee-form";
import { employeeService } from "@/services/hrService";
import { toast } from "@/hooks/use-toast";
import type { StaffInput } from "@/lib/validation/staff";

function NewEmployeeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") as StaffInput["category"] | null;

  async function handleSubmit(input: StaffInput) {
    const employee = await employeeService.create(input);
    toast({
      title: "Employee added",
      description: `${employee.fullName} (${employee.employeeId})`,
      variant: "success",
    });
    // Straight to the new profile so documents and education can be filed next.
    router.push(`/employees/${employee.id}`);
  }

  return <EmployeeForm onSubmit={handleSubmit} defaultValues={category ? { category } : undefined} />;
}

export default function NewEmployeePage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <Link
        href="/employees"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to employees
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-foreground">Add employee</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Education, experience and documents are filed from the profile once the record exists. A verification QR
          identifier is generated automatically on save.
        </p>
      </div>

      <Suspense>
        <NewEmployeeForm />
      </Suspense>
    </div>
  );
}
