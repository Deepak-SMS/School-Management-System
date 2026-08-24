"use client";

import { useRouter } from "next/navigation";
import { classService } from "@/services/classService";
import { ClassForm } from "@/features/classes/class-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewClassPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Classes", href: "/school/classes" },
            { label: "Add Class" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Class</h1>
      </div>
      <ClassForm
        onSubmit={async (input) => {
          const cls = await classService.create(input);
          toast({ title: "Class created", variant: "success" });
          router.push(`/school/classes/${cls.id}`);
        }}
      />
    </div>
  );
}
