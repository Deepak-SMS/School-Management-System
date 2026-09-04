"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { classService } from "@/services/classService";
import { ClassForm } from "@/features/classes/class-form";
import type { ClassInput } from "@/lib/validation/class";
import type { ClassRecord } from "@/types/class";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

function toDefaultValues(cls: ClassRecord): Partial<ClassInput> {
  return {
    name: cls.name,
    code: cls.code,
    academicYearId: cls.academicYear.id,
    campusId: cls.campus.id,
    sortOrder: cls.sortOrder,
    capacity: cls.capacity ?? undefined,
    classTeacherId: cls.classTeacherId ?? undefined,
    gradingSystem: cls.gradingSystem as ClassInput["gradingSystem"],
    status: cls.status as ClassInput["status"],
  };
}

export default function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [cls, setCls] = useState<ClassRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    classService
      .get(id)
      .then((c) => {
        setCls(c);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-3xl px-6 py-16" onRetry={load} />;
  if (!cls) return <LoadingState className="mx-auto max-w-3xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Classes", href: "/school/classes" },
            { label: cls.name, href: `/school/classes/${id}` },
            { label: "Edit" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {cls.name}</h1>
      </div>
      <ClassForm
        defaultValues={toDefaultValues(cls)}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await classService.update(id, input);
          toast({ title: "Class updated", variant: "success" });
          router.push(`/school/classes/${id}`);
        }}
      />
    </div>
  );
}
