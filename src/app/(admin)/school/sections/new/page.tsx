"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sectionService } from "@/services/sectionService";
import { SectionForm } from "@/features/sections/section-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "@/hooks/use-toast";

function NewSectionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sections are added from a class, so the class arrives prefilled.
  const classId = searchParams.get("classId");

  return (
    <>
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Classes", href: "/school/classes" },
            ...(classId ? [{ label: "Class", href: `/school/classes/${classId}` }] : []),
            { label: "Add Section" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Section</h1>
      </div>
      <SectionForm
        defaultValues={classId ? { classId } : undefined}
        onSubmit={async (input) => {
          const section = await sectionService.create(input);
          toast({ title: "Section created", variant: "success" });
          router.push(`/school/sections/${section.id}`);
        }}
      />
    </>
  );
}

export default function NewSectionPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <Suspense fallback={<LoadingState className="py-16" />}>
        <NewSectionForm />
      </Suspense>
    </div>
  );
}
