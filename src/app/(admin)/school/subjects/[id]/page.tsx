"use client";

import { use, useEffect, useState } from "react";
import { School, UserCog, Award } from "lucide-react";
import { subjectService } from "@/services/subjectService";
import type { SubjectRecord } from "@/types/subject";
import { SUBJECT_TYPE_LABELS } from "@/lib/constants/school";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { SubjectAssignmentPanel } from "@/features/subjects/subject-assignment-panel";

export default function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [subject, setSubject] = useState<SubjectRecord | null>(null);
  const [error, setError] = useState(false);

  function load() {
    subjectService.get(id).then(setSubject).catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState className="mx-auto max-w-4xl px-6 py-16" onRetry={load} />;
  if (!subject) return <LoadingState className="mx-auto max-w-4xl px-6 py-16" />;

  const teacherNames = new Set((subject.assignments ?? []).map((a) => a.teacher?.fullName).filter(Boolean));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb
          items={[
            { label: "School Management", href: "/school/profile" },
            { label: "Subjects", href: "/school/subjects" },
            { label: subject.name },
          ]}
        />
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{subject.name}</h1>
          <Badge variant={subject.status === "active" ? "success" : "neutral"}>{subject.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {subject.code} · {SUBJECT_TYPE_LABELS[subject.subjectType as keyof typeof SUBJECT_TYPE_LABELS] ?? subject.subjectType}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Classes assigned" value={subject.counts?.classes ?? 0} icon={School} />
        <StatCard label="Teachers" value={teacherNames.size} icon={UserCog} />
        <StatCard label="Max / Passing marks" value={`${subject.maxMarks ?? "—"} / ${subject.passingMarks ?? "—"}`} icon={Award} />
      </div>

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">Classes &amp; Sections</TabsTrigger>
          <TabsTrigger value="settings">Grade Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <SubjectAssignmentPanel subjectId={id} assignments={subject.assignments ?? []} onChange={load} />
        </TabsContent>

        <TabsContent value="settings" className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Nature" value={subject.natureType} />
          <Field label="Credits" value={subject.credits?.toString()} />
          <Field label="Grading system" value={subject.gradingSystem} />
          <Field label="Description" value={subject.description} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-foreground capitalize">{value || "—"}</p>
    </div>
  );
}
