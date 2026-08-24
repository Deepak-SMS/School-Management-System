"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { sectionInputSchema, type SectionInput } from "@/lib/validation/section";

type SectionFormValues = z.input<typeof sectionInputSchema>;
import { classService } from "@/services/classService";
import { staffService } from "@/services/staffService";
import type { ClassRecord } from "@/types/class";
import type { StaffRecord } from "@/types/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/loading-state";
import type { ApiError } from "@/services/studentService";

interface SectionFormProps {
  defaultValues?: Partial<SectionInput>;
  onSubmit: (input: SectionInput) => Promise<void>;
  submitLabel?: string;
}

export function SectionForm({ defaultValues, onSubmit, submitLabel = "Add section" }: SectionFormProps) {
  const [classes, setClasses] = useState<ClassRecord[] | null>(null);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SectionFormValues, unknown, SectionInput>({
    resolver: zodResolver(sectionInputSchema),
    defaultValues: { status: "active", ...defaultValues },
  });

  useEffect(() => {
    classService.list({ pageSize: 100, status: "active" }).then((r) => setClasses(r.data)).catch(() => setClasses([]));
    staffService.list({ pageSize: 200 }).then((r) => setStaff(r.data)).catch(() => {});
  }, []);

  const selectedClassId = watch("classId");
  const selectedClass = classes?.find((c) => c.id === selectedClassId);

  useEffect(() => {
    if (selectedClass) {
      setValue("academicYearId", selectedClass.academicYear.id);
      setValue("campusId", selectedClass.campus.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass?.id]);

  async function handleFormSubmit(values: SectionInput) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const apiError = error as ApiError;
      setServerError(apiError?.error ?? "Something went wrong. Please try again.");
    }
  }

  if (!classes) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5 text-primary-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && <Alert variant="danger" title="Couldn't save section">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Section details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
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
                          {c.name} ({c.academicYear.label})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Section name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register("name")} placeholder="Section A" />}
          </FormField>
          <FormField label="Section code" required error={errors.code?.message}>
            {(field) => <Input {...field} {...register("code")} placeholder="SEC-A" />}
          </FormField>
          <FormField label="Academic year">
            {() => <Input value={selectedClass?.academicYear.label ?? "Select a class first"} disabled readOnly />}
          </FormField>
          <FormField label="Campus">{() => <Input value={selectedClass?.campus.name ?? "Select a class first"} disabled readOnly />}</FormField>
          <FormField label="Classroom / Room" error={errors.room?.message}>
            {(field) => <Input {...field} {...register("room")} placeholder="Room 204" />}
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
          <FormField label="Capacity" error={errors.capacity?.message}>
            {(field) => <Input {...field} {...register("capacity")} type="number" min={1} />}
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
