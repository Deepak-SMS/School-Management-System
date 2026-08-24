"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { classInputSchema, type ClassInput } from "@/lib/validation/class";

type ClassFormValues = z.input<typeof classInputSchema>;
import { GRADING_SYSTEMS } from "@/lib/constants/school";
import { campusService } from "@/services/campusService";
import { academicYearService } from "@/services/academicYearService";
import { staffService } from "@/services/staffService";
import type { CampusRecord } from "@/types/campus";
import type { AcademicYearRecord } from "@/types/academicYear";
import type { StaffRecord } from "@/types/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/loading-state";
import type { ApiError } from "@/services/studentService";

interface ClassFormProps {
  defaultValues?: Partial<ClassInput>;
  onSubmit: (input: ClassInput) => Promise<void>;
  submitLabel?: string;
}

export function ClassForm({ defaultValues, onSubmit, submitLabel = "Add class" }: ClassFormProps) {
  const [campuses, setCampuses] = useState<CampusRecord[] | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues, unknown, ClassInput>({
    resolver: zodResolver(classInputSchema),
    defaultValues: { sortOrder: 0, status: "active", ...defaultValues },
  });

  useEffect(() => {
    campusService.list({ pageSize: 100 }).then((r) => setCampuses(r.data)).catch(() => setCampuses([]));
    academicYearService.list({ pageSize: 50 }).then((r) => setAcademicYears(r.data)).catch(() => {});
    staffService.list({ pageSize: 200 }).then((r) => setStaff(r.data)).catch(() => {});
  }, []);

  async function handleFormSubmit(values: ClassInput) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const apiError = error as ApiError;
      setServerError(apiError?.error ?? "Something went wrong. Please try again.");
    }
  }

  if (!campuses) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5 text-primary-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && <Alert variant="danger" title="Couldn't save class">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Class details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Class name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register("name")} placeholder="Class 10" />}
          </FormField>
          <FormField label="Class code" required error={errors.code?.message}>
            {(field) => <Input {...field} {...register("code")} placeholder="CLASS-10" />}
          </FormField>
          <FormField label="Academic year" required error={errors.academicYearId?.message}>
            {(field) => (
              <Controller
                name="academicYearId"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Campus" required error={errors.campusId?.message}>
            {(field) => (
              <Controller
                name="campusId"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select campus" />
                    </SelectTrigger>
                    <SelectContent>
                      {campuses.map((c) => (
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
          <FormField label="Display order" error={errors.sortOrder?.message}>
            {(field) => <Input {...field} {...register("sortOrder")} type="number" />}
          </FormField>
          <FormField label="Capacity" error={errors.capacity?.message}>
            {(field) => <Input {...field} {...register("capacity")} type="number" min={1} />}
          </FormField>
          <FormField label="Class teacher" error={errors.classTeacherId?.message}>
            {(field) => (
              <Controller
                name="classTeacherId"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select staff member" />
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
          <FormField label="Grading system" error={errors.gradingSystem?.message}>
            {(field) => (
              <Controller
                name="gradingSystem"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select grading system" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADING_SYSTEMS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Status" error={errors.status?.message}>
            {(field) => (
              <Controller
                name="status"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
