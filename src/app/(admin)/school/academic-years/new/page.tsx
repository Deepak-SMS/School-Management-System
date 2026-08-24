"use client";

import { useRouter } from "next/navigation";
import { academicYearService } from "@/services/academicYearService";
import { AcademicYearForm } from "@/features/academic-years/academic-year-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewAcademicYearPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Academic Years", href: "/school/academic-years" },
            { label: "Add Academic Year" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Academic Year</h1>
      </div>
      <AcademicYearForm
        allowCopy
        onSubmit={async (input, copyConfig) => {
          const year = await academicYearService.create(input, copyConfig);
          toast({ title: "Academic year created", variant: "success" });
          router.push(`/school/academic-years/${year.id}`);
        }}
      />
    </div>
  );
}
