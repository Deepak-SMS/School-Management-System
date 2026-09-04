"use client";

import { useEffect, useState } from "react";
import { Trash2, CalendarClock } from "lucide-react";
import { AssignmentScheduleModal } from "@/features/subjects/assignment-schedule-modal";
import { subjectService } from "@/services/subjectService";
import { academicYearService } from "@/services/academicYearService";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import { staffService } from "@/services/staffService";
import type { SubjectAssignmentRecord } from "@/types/subject";
import type { AcademicYearRecord } from "@/types/academicYear";
import type { ClassRecord } from "@/types/class";
import type { SectionRecord } from "@/types/section";
import type { StaffRecord } from "@/types/staff";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

export function SubjectAssignmentPanel({ subjectId, assignments, onChange }: {
  subjectId: string;
  assignments: SubjectAssignmentRecord[];
  onChange: () => void;
}) {
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [changingTeacherId, setChangingTeacherId] = useState<string | null>(null);
  const [schedulingAssignment, setSchedulingAssignment] = useState<SubjectAssignmentRecord | null>(null);

  const [academicYearId, setAcademicYearId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [scope, setScope] = useState<"all" | "sections">("all");
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  const [teacherId, setTeacherId] = useState<string>("");
  const [yearFieldError, setYearFieldError] = useState<string | null>(null);
  const [classFieldError, setClassFieldError] = useState<string | null>(null);
  const [sectionsFieldError, setSectionsFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    academicYearService.list({ pageSize: 50 }).then((r) => {
      setAcademicYears(r.data);
      // Default to the active academic year so a new assignment never lands
      // in a draft/archived year by accident — same rule class-form.tsx follows.
      const current = r.data.find((y) => y.status === "active") ?? r.data[0];
      if (current) setAcademicYearId(current.id);
    });
    classService.list({ pageSize: 100, status: "active" }).then((r) => setClasses(r.data));
    staffService.list({ pageSize: 200, category: "teacher" }).then((r) => setStaff(r.data));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSections() {
      if (!classId) {
        if (!cancelled) {
          setSections([]);
          setSelectedSectionIds(new Set());
        }
        return;
      }
      const result = await sectionService.list({ classId, pageSize: 100, status: "active" });
      if (!cancelled) {
        setSections(result.data);
        setSelectedSectionIds(new Set());
      }
    }
    loadSections();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  function toggleSection(id: string) {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setYearFieldError(null);
    setClassFieldError(null);
    setSectionsFieldError(null);

    let hasError = false;
    if (!academicYearId) {
      setYearFieldError("Academic year is required");
      hasError = true;
    }
    if (!classId) {
      setClassFieldError("Class is required");
      hasError = true;
    }
    if (scope === "sections" && selectedSectionIds.size === 0) {
      setSectionsFieldError("Choose at least one section, or switch to “All sections”.");
      hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      const result = await subjectService.bulkAssign(subjectId, {
        academicYearId,
        classId,
        scope,
        sectionIds: scope === "sections" ? Array.from(selectedSectionIds) : undefined,
        teacherId: teacherId || undefined,
      });
      if (result.createdCount > 0) {
        toast({
          title: result.createdCount === 1 ? "Subject assigned" : `Assigned to ${result.createdCount} sections`,
          description: result.skippedCount > 0 ? `${result.skippedCount} already had this subject and were skipped.` : undefined,
          variant: "success",
        });
      } else {
        toast({ title: "Already assigned", description: "Every selected section already has this subject.", variant: "default" });
      }
      setClassId("");
      setScope("all");
      setSelectedSectionIds(new Set());
      setTeacherId("");
      onChange();
    } catch (error) {
      const apiError = error as ApiError;
      toast({ title: apiError?.error ?? "Couldn't assign subject", variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTeacherChange(assignment: SubjectAssignmentRecord, value: string) {
    setChangingTeacherId(assignment.id);
    try {
      await subjectService.updateAssignmentTeacher(subjectId, assignment.id, value === "unassigned" ? null : value);
      toast({
        title: value === "unassigned" ? "Teacher removed" : "Teacher updated",
        variant: "success",
      });
      onChange();
    } catch (error) {
      const apiError = error as ApiError;
      toast({ title: apiError?.error ?? "Couldn't update the teacher", variant: "danger" });
    } finally {
      setChangingTeacherId(null);
    }
  }

  async function handleRemove(assignmentId: string) {
    setRemovingId(assignmentId);
    try {
      await subjectService.unassign(subjectId, assignmentId);
      toast({ title: "Assignment removed", variant: "success" });
      onChange();
    } catch {
      toast({ title: "Couldn't remove assignment", variant: "danger" });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAssign} className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>Academic year</Label>
            <Select value={academicYearId} onValueChange={setAcademicYearId}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {yearFieldError && <p className="text-xs font-medium text-danger-600">{yearFieldError}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
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
            {classFieldError && <p className="text-xs font-medium text-danger-600">{classFieldError}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {classId && (
          <div className="flex flex-col gap-3 rounded-md bg-background p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  scope === "all" ? "border-primary-600 bg-primary-50 text-primary-700" : "border-border-strong text-muted-foreground hover:text-foreground",
                )}
              >
                All sections in this class
              </button>
              <button
                type="button"
                onClick={() => setScope("sections")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  scope === "sections" ? "border-primary-600 bg-primary-50 text-primary-700" : "border-border-strong text-muted-foreground hover:text-foreground",
                )}
              >
                Choose specific sections
              </button>
            </div>

            {scope === "all" ? (
              <p className="text-xs text-muted-foreground">
                This subject will apply to every current and future section of this class — no need to repeat it per section.
              </p>
            ) : sections.length === 0 ? (
              <p className="text-xs text-muted-foreground">This class has no sections yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {sections.map((section) => (
                  <label key={section.id} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={selectedSectionIds.has(section.id)}
                      onCheckedChange={() => toggleSection(section.id)}
                    />
                    {section.name}
                  </label>
                ))}
              </div>
            )}
            {sectionsFieldError && <p className="text-xs font-medium text-danger-600">{sectionsFieldError}</p>}
          </div>
        )}

        <div>
          <Button type="submit" size="sm" isLoading={submitting}>
            Assign
          </Button>
        </div>
      </form>

      {assignments.length === 0 ? (
        <EmptyState title="Not assigned yet" description="Use the form above to assign this subject to a class." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Academic Year</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Periods/wk</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.academicYear.label}</TableCell>
                <TableCell>{a.class.name}</TableCell>
                <TableCell>{a.section?.name ?? "All sections"}</TableCell>
                <TableCell>
                  <Select
                    value={a.teacher?.id ?? "unassigned"}
                    onValueChange={(value) => handleTeacherChange(a, value)}
                    disabled={changingTeacherId === a.id}
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{a.periodsPerWeek > 0 ? a.periodsPerWeek : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setSchedulingAssignment(a)}>
                    <CalendarClock className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" isLoading={removingId === a.id} onClick={() => handleRemove(a.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {schedulingAssignment && (
        <AssignmentScheduleModal
          subjectId={subjectId}
          assignment={schedulingAssignment}
          onClose={() => setSchedulingAssignment(null)}
          onSaved={onChange}
        />
      )}
    </div>
  );
}
