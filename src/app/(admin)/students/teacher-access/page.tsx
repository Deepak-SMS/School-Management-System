"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, GraduationCap, Users } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

interface TeacherAccessRow {
  id: string;
  fullName: string;
  employeeId: string;
  homerooms: { classId: string; className: string; sectionId: string; sectionName: string }[];
  subjectClasses: { subjectId: string; subjectName: string; classId: string; className: string; sectionId: string; sectionName: string }[];
}

export default function TeacherAccessPage() {
  const [rows, setRows] = useState<TeacherAccessRow[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    fetch("/api/teacher-access")
      .then((r) => r.json())
      .then((body) => setRows(body.data))
      .catch(() => setError(true));
  }

  useEffect(() => {
    fetch("/api/teacher-access")
      .then((r) => r.json())
      .then((body) => setRows(body.data))
      .catch(() => setError(true));
  }, []);

  if (error) return <ErrorState className="mx-auto max-w-4xl px-6 py-16" onRetry={load} />;
  if (!rows) return <LoadingState className="mx-auto max-w-4xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Students", href: "/students" }, { label: "Teacher Access" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Teacher Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Which students each teacher can see and mark attendance for — a class teacher gets their class&apos;s full
          roster, a subject teacher gets attendance-only access to the classes they teach that subject in.
        </p>
      </div>

      <Alert variant="info" title="This is a read-only overview">
        Assign a class teacher from <Link href="/school/sections" className="underline">School Management → Sections</Link>{" "}
        (edit a section). Assign subject teachers from{" "}
        <Link href="/school/subjects" className="underline">School Management → Subjects</Link> → a subject&apos;s
        &quot;Classes &amp; Sections&quot; tab.
      </Alert>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No teachers yet" description="Add a staff member with the Teacher category to see them here." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((teacher) => (
            <Card key={teacher.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{teacher.fullName}</p>
                    <p className="text-xs text-muted-foreground">{teacher.employeeId}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" />
                    {teacher.homerooms.length + teacher.subjectClasses.length === 0 ? "No access granted yet" : "Access summary"}
                  </div>
                </div>

                {teacher.homerooms.length === 0 && teacher.subjectClasses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Not assigned as a class teacher or a subject teacher for any class yet.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {teacher.homerooms.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <GraduationCap className="size-3.5" /> Class teacher of
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {teacher.homerooms.map((h) => (
                            <Badge key={h.sectionId} variant="primary">
                              {h.className} - {h.sectionName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {teacher.subjectClasses.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <Users className="size-3.5" /> Teaches subject to
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {teacher.subjectClasses.map((s) => (
                            <Badge key={`${s.subjectId}-${s.sectionId}`} variant="neutral">
                              {s.className} - {s.sectionName} ({s.subjectName})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
