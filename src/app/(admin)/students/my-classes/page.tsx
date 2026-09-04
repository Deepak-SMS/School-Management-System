"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Users } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { RosterView } from "@/features/attendance/roster-view";

interface Homeroom {
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
}

interface SubjectClass {
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
}

type Selection = { kind: "homeroom"; homeroom: Homeroom } | { kind: "subject"; subjectClass: SubjectClass };

export default function MyClassesPage() {
  const [scope, setScope] = useState<{ homerooms: Homeroom[]; subjectClasses: SubjectClass[] } | null>(null);
  const [error, setError] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  function load() {
    setError(false);
    fetch("/api/my/teaching-scope")
      .then((r) => r.json())
      .then(setScope)
      .catch(() => setError(true));
  }

  useEffect(() => {
    fetch("/api/my/teaching-scope")
      .then((r) => r.json())
      .then(setScope)
      .catch(() => setError(true));
  }, []);

  if (error) return <ErrorState className="mx-auto max-w-4xl px-6 py-16" onRetry={load} />;
  if (!scope) return <LoadingState className="mx-auto max-w-4xl px-6 py-16" />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Students", href: "/students" }, { label: "My Classes & Subjects" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">My Classes &amp; Subjects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full access to the class you&apos;re the class teacher of; attendance-only access to classes you teach a subject in.
        </p>
      </div>

      {!selection && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <GraduationCap className="size-4" /> My classes (class teacher)
            </h2>
            {scope.homerooms.length === 0 ? (
              <EmptyState title="Not a class teacher yet" description="You'll see your class here once assigned by a school admin." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {scope.homerooms.map((h) => (
                  <button
                    key={h.sectionId}
                    onClick={() => setSelection({ kind: "homeroom", homeroom: h })}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/50"
                  >
                    <span className="font-medium text-foreground">
                      {h.className} - {h.sectionName}
                    </span>
                    <Badge variant="primary">Class teacher</Badge>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="size-4" /> Subjects I teach
            </h2>
            {scope.subjectClasses.length === 0 ? (
              <EmptyState title="No subject assignments yet" description="You'll see these once a school admin assigns you to a subject." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {scope.subjectClasses.map((s) => (
                  <button
                    key={`${s.subjectId}-${s.sectionId}`}
                    onClick={() => setSelection({ kind: "subject", subjectClass: s })}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50/50"
                  >
                    <span className="font-medium text-foreground">
                      {s.className} - {s.sectionName}
                    </span>
                    <Badge variant="neutral">{s.subjectName}</Badge>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {selection && (
        <RosterView
          classId={selection.kind === "homeroom" ? selection.homeroom.classId : selection.subjectClass.classId}
          sectionId={selection.kind === "homeroom" ? selection.homeroom.sectionId : selection.subjectClass.sectionId}
          subjectId={selection.kind === "subject" ? selection.subjectClass.subjectId : undefined}
          title={
            selection.kind === "homeroom"
              ? `${selection.homeroom.className} - ${selection.homeroom.sectionName}`
              : `${selection.subjectClass.className} - ${selection.subjectClass.sectionName} · ${selection.subjectClass.subjectName}`
          }
          onBack={() => setSelection(null)}
        />
      )}
    </div>
  );
}
