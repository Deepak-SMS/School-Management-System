"use client";

import { useRouter } from "next/navigation";
import { salaryStructureService } from "@/services/payrollService";
import { SalaryStructureForm } from "@/features/payroll/salary-structure-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewSalaryStructurePage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "HR & Payroll", href: "/hr" },
            { label: "Payroll", href: "/hr/payroll" },
            { label: "Salary Structures", href: "/hr/payroll/structures" },
            { label: "Add Structure" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Salary Structure</h1>
      </div>
      <SalaryStructureForm
        onSubmit={async (input) => {
          const structure = await salaryStructureService.create(input);
          toast({ title: "Salary structure created", variant: "success" });
          router.push(`/hr/payroll/structures/${structure.id}`);
        }}
      />
    </div>
  );
}
