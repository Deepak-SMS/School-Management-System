"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { subjectService } from "@/services/subjectService";
import { staffService } from "@/services/staffService";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import { academicYearService } from "@/services/academicYearService";
import type { SubjectRecord } from "@/types/subject";
import type { StaffRecord } from "@/types/staff";
import type { ClassRecord } from "@/types/class";
import type { SectionRecord } from "@/types/section";
import type { AcademicYearRecord } from "@/types/academicYear";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

/**
 * Assigns a teacher to a subject for a class.
 *
 * The teacher list is restricted to staff in **academic** departments — a
 * subject is taught by academic staff, so a driver or a librarian never appears
 * here. That filter is applied server-side via `departmentType=academic`, not by
 * hiding rows on the client.
 *
 * A teacher is only meaningful against a class, because that's what
 * SubjectAssignment records — so the class is required alongside the teacher.
 */
export function AssignTeacherModal({
  subject,
  onClose,
  onAssigned,
}: {
  subject: SubjectRecord;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [teachers, setTeachers] = useState<StaffRecord[] | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [years, setYears] = useState<AcademicYearRecord[]>([]);
  const [loadedSections, setLoadedSections] = useState<{ classId: string; items: SectionRecord[] }>({
    classId: "",
    items: [],
  });

  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [scope, setScope] = useState<"all" | "sections">("all");
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      // Only academic-department staff are offered as teachers.
      staffService.list({ pageSize: 200, departmentType: "academic", employmentStatus: "active" }),
      classService.list({ pageSize: 200, status: "active" }),
      academicYearService.list({ pageSize: 50 }),
    ])
      .then(([staffResult, classResult, yearResult]) => {
        if (cancelled) return;
        setTeachers(staffResult.data);
        setClasses(classResult.data);
        setYears(yearResult.data);
        const current = yearResult.data.find((y) => y.status === "active") ?? yearResult.data[0];
        if (current) setAcademicYearId(current.id);
      })
      .catch(() => {
        if (!cancelled) {
          setTeachers([]);
          setError("Couldn't load teachers and classes.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Sections are stored with the class they belong to, and `sections` is derived
  // from that. This keeps setState out of the effect body, and means switching
  // class can never briefly show the previous class's sections.
  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    sectionService
      .list({ classId, pageSize: 100, status: "active" })
      .then((r) => {
        if (!cancelled) setLoadedSections({ classId, items: r.data });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [classId]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await subjectService.bulkAssign(subject.id, {
        academicYearId,
        classId,
        scope,
        sectionIds: scope === "sections" ? Array.from(selectedSections) : undefined,
        teacherId,
      });

      if (result.createdCount > 0) {
        toast({
          title: `${subject.name} assigned`,
          description:
            result.skippedCount > 0
              ? `${result.skippedCount} already had this subject and were skipped.`
              : undefined,
          variant: "success",
        });
        onAssigned();
      } else {
        setError("That class already has this subject for the selected sections.");
      }
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't assign the teacher.");
    } finally {
      setBusy(false);
    }
  }

  /** Only the sections that belong to the currently selected class. */
  const sections = loadedSections.classId === classId ? loadedSections.items : [];
  const noTeachers = teachers?.length === 0;

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title={`Add teacher to ${subject.name}`}
        description="Only staff in academic departments can teach a subject."
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          {!teachers && <LoadingState />}

          {noTeachers && (
            <Alert variant="warning" title="No academic staff found">
              Teachers must belong to a department of type <strong>Academic</strong>. Assign staff to one first —{" "}
              <Link href="/school/departments" className="underline">
                Departments
              </Link>
              .
            </Alert>
          )}

          {teachers && teachers.length > 0 && (
            <>
              <FormField label="Teacher" required description="Staff in academic departments only">
                {(f) => (
                  <Select value={teacherId} onValueChange={setTeacherId}>
                    <SelectTrigger id={f.id}>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.fullName}
                          {t.designation ? ` — ${t.designation}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField label="Academic year" required>
                {(f) => (
                  <Select value={academicYearId} onValueChange={setAcademicYearId}>
                    <SelectTrigger id={f.id}>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField label="Class" required description="A teacher is assigned to teach this subject to a class">
                {(f) => (
                  <Select
                    value={classId}
                    onValueChange={(v) => {
                      setClassId(v);
                      // Selections belong to the previous class, so drop them.
                      setSelectedSections(new Set());
                    }}
                  >
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

              {classId && (
                <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                  <div className="flex flex-wrap gap-2">
                    <ScopeButton active={scope === "all"} onClick={() => setScope("all")}>
                      All sections
                    </ScopeButton>
                    <ScopeButton active={scope === "sections"} onClick={() => setScope("sections")}>
                      Specific sections
                    </ScopeButton>
                  </div>

                  {scope === "all" ? (
                    <p className="text-xs text-muted-foreground">
                      Applies to every current and future section of this class.
                    </p>
                  ) : sections.length === 0 ? (
                    <p className="text-xs text-muted-foreground">This class has no sections yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {sections.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedSections.has(s.id)}
                            onCheckedChange={() =>
                              setSelectedSections((prev) => {
                                const next = new Set(prev);
                                if (next.has(s.id)) next.delete(s.id);
                                else next.add(s.id);
                                return next;
                              })
                            }
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              isLoading={busy}
              disabled={
                !teacherId ||
                !classId ||
                !academicYearId ||
                (scope === "sections" && selectedSections.size === 0)
              }
            >
              Assign teacher
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

/** Shared with AssignTeacherToClassModal (src/features/subjects/assign-teacher-to-class-modal.tsx). */
export function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary-600 bg-primary-50 text-primary-700"
          : "border-border-strong text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
