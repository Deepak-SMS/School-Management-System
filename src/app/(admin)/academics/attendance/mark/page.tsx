"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { RosterView } from "@/features/attendance/roster-view";
import { useClassSectionPicker, DAILY_VALUE } from "@/features/attendance/use-class-section-picker";

/**
 * The admin-facing counterpart to the teacher's `/students/my-classes` —
 * same `RosterView`, but the class/section/subject picker below browses
 * every class in the school rather than `getTeacherScope()`'s narrower list,
 * since `GET /api/my/students` already treats a non-teacher caller as free
 * to view any class/section (see that route's own scoping check).
 */
function MarkAttendanceContent() {
  const searchParams = useSearchParams();
  // Arrives here from the Attendance Dashboard's "Mark now" / "Review" links.
  const prefillClassId = searchParams.get("classId") ?? "";
  const {
    classes,
    classId,
    setClassId,
    sections,
    sectionId,
    setSectionId,
    subjects,
    subjectId,
    setSubjectId,
    selectedClass,
    selectedSection,
    subjectName,
  } = useClassSectionPicker(prefillClassId);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Breadcrumb items={[{ label: "Attendance", href: "/academics/attendance" }, { label: "Mark Attendance" }]} />
        <h1 className="mt-2 text-xl font-semibold text-foreground">Mark Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a class and section — every class in the school, not just your own.</p>
      </div>

      {!classes ? (
        <LoadingState className="py-16" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Class" required>
            {(f) => (
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Section" required>
            {(f) => (
              <Select value={sectionId} onValueChange={setSectionId} disabled={!classId || sections.length === 0}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder={classId ? "Select section" : "Select a class first"} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Subject" description="Daily = homeroom attendance">
            {(f) => (
              <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DAILY_VALUE}>Daily (homeroom)</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        </div>
      )}

      {selectedClass && selectedSection && (
        <RosterView
          key={`${classId}-${sectionId}-${subjectId}`}
          classId={classId}
          sectionId={sectionId}
          subjectId={subjectId === DAILY_VALUE ? undefined : subjectId}
          title={`${selectedClass.name} - ${selectedSection.name}${subjectName ? ` · ${subjectName}` : ""}`}
          canBypassLock
          onBack={() => setClassId("")}
        />
      )}
    </div>
  );
}

export default function MarkAttendancePage() {
  return (
    <Suspense fallback={<LoadingState className="mx-auto max-w-4xl px-6 py-16" />}>
      <MarkAttendanceContent />
    </Suspense>
  );
}
