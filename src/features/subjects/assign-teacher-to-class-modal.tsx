"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { subjectService } from "@/services/subjectService";
import { staffService } from "@/services/staffService";
import { sectionService } from "@/services/sectionService";
import type { SubjectRecord } from "@/types/subject";
import type { StaffRecord } from "@/types/staff";
import type { SectionRecord } from "@/types/section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "@/hooks/use-toast";
import { ScopeButton } from "@/features/subjects/assign-teacher-modal";
import type { ApiError } from "@/services/studentService";

/**
 * Assigns a teacher to a subject for one already-known class — the
 * class-scoped counterpart to AssignTeacherModal, which is opened from the
 * Subjects list where no class is known yet and so has to ask for one. Here
 * the class (and its academic year) are fixed by the page this opens from,
 * so it only ever asks for the teacher.
 */
export function AssignTeacherToClassModal({
  subject,
  classId,
  academicYearId,
  onClose,
  onAssigned,
}: {
  subject: SubjectRecord;
  classId: string;
  academicYearId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [teachers, setTeachers] = useState<StaffRecord[] | null>(null);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [scope, setScope] = useState<"all" | "sections">("all");
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      // Only academic-department staff are offered as teachers.
      staffService.list({ pageSize: 200, departmentType: "academic", employmentStatus: "active" }),
      sectionService.list({ classId, pageSize: 100, status: "active" }),
    ])
      .then(([staffResult, sectionResult]) => {
        if (cancelled) return;
        setTeachers(staffResult.data);
        setSections(sectionResult.data);
      })
      .catch(() => {
        if (!cancelled) {
          setTeachers([]);
          setError("Couldn't load teachers.");
        }
      });
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
            result.skippedCount > 0 ? `${result.skippedCount} already had this subject and were skipped.` : undefined,
          variant: "success",
        });
        onAssigned();
      } else {
        setError("This class already has this subject for the selected sections.");
      }
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't assign the teacher.");
    } finally {
      setBusy(false);
    }
  }

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
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              isLoading={busy}
              disabled={!teacherId || (scope === "sections" && selectedSections.size === 0)}
            >
              Assign teacher
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
