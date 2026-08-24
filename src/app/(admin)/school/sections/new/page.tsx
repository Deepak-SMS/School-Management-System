"use client";

import { useRouter } from "next/navigation";
import { sectionService } from "@/services/sectionService";
import { SectionForm } from "@/features/sections/section-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewSectionPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Sections", href: "/school/sections" },
            { label: "Add Section" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Section</h1>
      </div>
      <SectionForm
        onSubmit={async (input) => {
          const section = await sectionService.create(input);
          toast({ title: "Section created", variant: "success" });
          router.push(`/school/sections/${section.id}`);
        }}
      />
    </div>
  );
}
