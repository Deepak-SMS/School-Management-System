"use client";

import { useRouter } from "next/navigation";
import { departmentService } from "@/services/departmentService";
import { DepartmentForm } from "@/features/departments/department-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewDepartmentPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Departments", href: "/school/departments" },
            { label: "Add Department" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Department</h1>
      </div>
      <DepartmentForm
        onSubmit={async (input) => {
          const department = await departmentService.create(input);
          toast({ title: "Department created", variant: "success" });
          router.push(`/school/departments/${department.id}`);
        }}
      />
    </div>
  );
}
