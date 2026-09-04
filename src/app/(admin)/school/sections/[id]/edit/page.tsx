"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sectionService } from "@/services/sectionService";
import { SectionForm } from "@/features/sections/section-form";
import type { SectionInput } from "@/lib/validation/section";
import type { SectionRecord } from "@/types/section";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

function toDefaultValues(section: SectionRecord): Partial<SectionInput> {
  return {
    name: section.name,
    code: section.code,
    classId: section.class.id,
    academicYearId: section.academicYear.id,
    campusId: section.campus.id,
    room: section.room ?? undefined,
    classTeacherId: section.classTeacherId ?? undefined,
    capacity: section.capacity ?? undefined,
    status: section.status as SectionInput["status"],
  };
}

export default function EditSectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [section, setSection] = useState<SectionRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    sectionService
      .get(id)
      .then((s) => {
        setSection(s);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!section) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Classes", href: "/school/classes" },
            { label: section.class.name, href: `/school/classes/${section.class.id}` },
            { label: section.name, href: `/school/sections/${id}` },
            { label: "Edit" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {section.name}</h1>
      </div>
      <SectionForm
        defaultValues={toDefaultValues(section)}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await sectionService.update(id, input);
          toast({ title: "Section updated", variant: "success" });
          router.push(`/school/classes/${section.class.id}`);
        }}
      />
    </div>
  );
}
