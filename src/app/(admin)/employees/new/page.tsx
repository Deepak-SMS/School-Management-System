"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StaffForm } from "@/features/staff/staff-form";
import { staffService } from "@/services/staffService";
import { toast } from "@/hooks/use-toast";
import type { StaffInput } from "@/lib/validation/staff";

function NewStaffForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") as StaffInput["category"] | null;

  async function handleSubmit(input: StaffInput) {
    const staff = await staffService.create(input);
    toast({ title: "Staff member added", description: `${staff.fullName} (${staff.employeeId})`, variant: "success" });
    router.push(category === "teacher" ? "/employees/teachers" : "/employees");
  }

  return <StaffForm onSubmit={handleSubmit} defaultValues={category ? { category } : undefined} />;
}

export default function NewStaffPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Add staff member</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A verification QR identifier is generated automatically once the record is saved.
        </p>
      </div>
      <Suspense>
        <NewStaffForm />
      </Suspense>
    </div>
  );
}
