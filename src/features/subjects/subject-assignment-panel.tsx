"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { subjectAssignmentInputSchema, type SubjectAssignmentInput } from "@/lib/validation/subject";
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
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";
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

  const {
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectAssignmentInput>({ resolver: zodResolver(subjectAssignmentInputSchema) });

  useEffect(() => {
    academicYearService.list({ pageSize: 50 }).then((r) => setAcademicYears(r.data));
    classService.list({ pageSize: 100, status: "active" }).then((r) => setClasses(r.data));
    staffService.list({ pageSize: 200, category: "teacher" }).then((r) => setStaff(r.data));
  }, []);

  const selectedClassId = watch("classId");
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      return;
    }
    sectionService.list({ classId: selectedClassId, pageSize: 100, status: "active" }).then((r) => setSections(r.data));
  }, [selectedClassId]);

  async function handleAssign(values: SubjectAssignmentInput) {
    try {
      await subjectService.assign(subjectId, values);
      toast({ title: "Subject assigned", variant: "success" });
      reset({ academicYearId: undefined, classId: undefined, sectionId: undefined, teacherId: undefined });
      onChange();
    } catch (error) {
      const apiError = error as ApiError;
      toast({ title: apiError?.error ?? "Couldn't assign subject", variant: "danger" });
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
      <form onSubmit={handleSubmit(handleAssign)} className="grid gap-4 sm:grid-cols-4">
        <FormField label="Academic year" required error={errors.academicYearId?.message}>
          {(field) => (
            <Controller
              name="academicYearId"
              control={control}
              render={({ field: selectField }) => (
                <Select value={selectField.value} onValueChange={selectField.onChange}>
                  <SelectTrigger id={field.id}>
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
              )}
            />
          )}
        </FormField>
        <FormField label="Class" required error={errors.classId?.message}>
          {(field) => (
            <Controller
              name="classId"
              control={control}
              render={({ field: selectField }) => (
                <Select value={selectField.value} onValueChange={selectField.onChange}>
                  <SelectTrigger id={field.id}>
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
            />
          )}
        </FormField>
        <FormField label="Section">
          {(field) => (
            <Controller
              name="sectionId"
              control={control}
              render={({ field: selectField }) => (
                <Select value={selectField.value} onValueChange={selectField.onChange} disabled={!selectedClassId}>
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder="All sections" />
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
            />
          )}
        </FormField>
        <FormField label="Teacher">
          {(field) => (
            <Controller
              name="teacherId"
              control={control}
              render={({ field: selectField }) => (
                <Select value={selectField.value} onValueChange={selectField.onChange}>
                  <SelectTrigger id={field.id}>
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
              )}
            />
          )}
        </FormField>
        <div className="sm:col-span-4">
          <Button type="submit" size="sm" isLoading={isSubmitting}>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.academicYear.label}</TableCell>
                <TableCell>{a.class.name}</TableCell>
                <TableCell>{a.section?.name ?? "All sections"}</TableCell>
                <TableCell>{a.teacher?.fullName ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" isLoading={removingId === a.id} onClick={() => handleRemove(a.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
