"use client";

import { useRouter } from "next/navigation";
import { subjectService } from "@/services/subjectService";
import { SubjectForm } from "@/features/subjects/subject-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";

export default function NewSubjectPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Subjects", href: "/school/subjects" },
            { label: "Add Subject" },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Add Subject</h1>
      </div>
      <SubjectForm
        onSubmit={async (input) => {
          const subject = await subjectService.create(input);
          toast({ title: "Subject created", variant: "success" });
          router.push(`/school/subjects/${subject.id}`);
        }}
      />
    </div>
  );
}
