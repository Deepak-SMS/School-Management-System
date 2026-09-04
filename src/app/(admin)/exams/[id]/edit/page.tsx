"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { examService } from "@/services/examService";
import { ExamForm } from "@/features/exams/exam-form";
import type { ExamRecord } from "@/types/exam";
import type { EXAM_RESULT_TYPES, EXAM_STATUSES } from "@/lib/constants/exam";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Spinner } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/hooks/use-toast";

export default function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [exam, setExam] = useState<ExamRecord | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    examService
      .get(id)
      .then(setExam)
      .catch(() => setError(true));
  }, [id]);

  if (error) return <ErrorState description="Couldn't load this exam." />;
  if (!exam) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5 text-primary-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Examination", href: "/exams" }, { label: "All Exams", href: "/exams" }, { label: exam.name }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Edit {exam.name}</h1>
      </div>
      <ExamForm
        defaultValues={{
          name: exam.name,
          code: exam.code,
          academicYearId: exam.academicYear.id,
          examTypeId: exam.examType.id,
          term: exam.term ?? undefined,
          startDate: exam.startDate.slice(0, 10),
          endDate: exam.endDate.slice(0, 10),
          resultDate: exam.resultDate ? exam.resultDate.slice(0, 10) : undefined,
          resultType: exam.resultType as (typeof EXAM_RESULT_TYPES)[number],
          status: exam.status as (typeof EXAM_STATUSES)[number],
        }}
        defaultClasses={exam.classes}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await examService.update(id, input);
          toast({ title: "Exam updated", variant: "success" });
          router.push("/exams");
        }}
      />
    </div>
  );
}
