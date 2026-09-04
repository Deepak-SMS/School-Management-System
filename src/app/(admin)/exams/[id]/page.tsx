"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { examService } from "@/services/examService";
import type { ExamRecord } from "@/types/exam";
import { EXAM_CATEGORY_LABELS, EXAM_RESULT_TYPE_LABELS, EXAM_STATUS_LABELS } from "@/lib/constants/exam";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

const STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "primary"> = {
  draft: "neutral",
  scheduled: "primary",
  ongoing: "warning",
  completed: "primary",
  results_pending: "warning",
  published: "success",
  archived: "neutral",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatDateRange(start: string, end: string): string {
  return start.slice(0, 10) === end.slice(0, 10) ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

export default function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useCurrentUser();
  const canEdit = hasPermission(user.role, "exams", "edit");

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
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{exam.name}</h1>
              <Badge variant={STATUS_VARIANT[exam.status] ?? "neutral"}>
                {EXAM_STATUS_LABELS[exam.status as keyof typeof EXAM_STATUS_LABELS] ?? exam.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {exam.code}
              {exam.term ? ` · ${exam.term}` : ""}
            </p>
          </div>
          {canEdit && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/exams/${exam.id}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exam details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Detail label="Type" value={exam.examType.name} />
          <Detail label="Category" value={EXAM_CATEGORY_LABELS[exam.examType.examCategory as keyof typeof EXAM_CATEGORY_LABELS] ?? exam.examType.examCategory} />
          <Detail label="Academic year" value={exam.academicYear.label} />
          <Detail label="Term" value={exam.term ?? undefined} />
          <Detail label="Dates" value={formatDateRange(exam.startDate, exam.endDate)} />
          <Detail label="Result date" value={exam.resultDate ? formatDate(exam.resultDate) : undefined} />
          <Detail label="Result type" value={EXAM_RESULT_TYPE_LABELS[exam.resultType as keyof typeof EXAM_RESULT_TYPE_LABELS] ?? exam.resultType} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classes &amp; sections</CardTitle>
        </CardHeader>
        <CardContent>
          {exam.classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes assigned to this exam yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {exam.classes.map((c) => (
                <li key={c.id ?? `${c.classId}-${c.sectionId ?? "all"}`}>
                  <Badge variant="neutral">
                    {c.className}
                    {c.sectionName ? ` – ${c.sectionName}` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}
