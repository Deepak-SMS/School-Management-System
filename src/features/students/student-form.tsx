"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { studentInputSchema, type StudentInput } from "@/lib/validation/student";

/** Pre-validation shape (e.g. `status` optional before its zod `.default()` applies) — what the form fields actually hold. */
type StudentFormValues = z.input<typeof studentInputSchema>;
import { BLOOD_GROUPS, GENDERS, STUDENT_STATUSES } from "@/lib/constants/people";
import { schoolStructureService } from "@/services/schoolStructureService";
import type { SchoolStructure } from "@/types/student";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/loading-state";
import type { ApiError } from "@/services/studentService";

interface StudentFormProps {
  defaultValues?: Partial<StudentInput>;
  onSubmit: (input: StudentInput) => Promise<void>;
  submitLabel?: string;
}

export function StudentForm({ defaultValues, onSubmit, submitLabel = "Add student" }: StudentFormProps) {
  const [structure, setStructure] = useState<SchoolStructure | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues, unknown, StudentInput>({
    resolver: zodResolver(studentInputSchema),
    defaultValues: { status: "active", ...defaultValues },
  });

  useEffect(() => {
    schoolStructureService.get().then(setStructure).catch(() => setServerError("Couldn't load classes/sections."));
  }, []);

  const selectedClassId = watch("classId");
  const sections = structure?.classes.find((c) => c.id === selectedClassId)?.sections ?? [];

  async function handleFormSubmit(values: StudentInput) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const apiError = error as ApiError;
      setServerError(apiError?.error ?? "Something went wrong. Please try again.");
    }
  }

  if (!structure) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5 text-primary-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && <Alert variant="danger" title="Couldn't save student">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Admission number" required error={errors.admissionNumber?.message}>
            {(field) => <Input {...field} {...register("admissionNumber")} placeholder="ADM021" />}
          </FormField>
          <FormField label="First name" required error={errors.firstName?.message}>
            {(field) => <Input {...field} {...register("firstName")} placeholder="Aarav" />}
          </FormField>
          <FormField label="Middle name" error={errors.middleName?.message}>
            {(field) => <Input {...field} {...register("middleName")} />}
          </FormField>
          <FormField label="Last name" required error={errors.lastName?.message}>
            {(field) => <Input {...field} {...register("lastName")} placeholder="Sharma" />}
          </FormField>
          <FormField label="Date of birth" error={errors.dateOfBirth?.message}>
            {(field) => <Input {...field} {...register("dateOfBirth")} type="date" />}
          </FormField>
          <FormField label="Gender" error={errors.gender?.message}>
            {(field) => (
              <Controller
                name="gender"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g[0].toUpperCase() + g.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Blood group" error={errors.bloodGroup?.message}>
            {(field) => (
              <Controller
                name="bloodGroup"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((bg) => (
                        <SelectItem key={bg} value={bg}>
                          {bg}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
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
                      {structure.academicYears.map((year) => (
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
                      {structure.classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Section" error={errors.sectionId?.message}>
            {(field) => (
              <Controller
                name="sectionId"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange} disabled={!selectedClassId}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder={selectedClassId ? "Select section" : "Select a class first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Roll number" error={errors.rollNumber?.message}>
            {(field) => <Input {...field} {...register("rollNumber")} />}
          </FormField>
          <FormField label="House" error={errors.house?.message}>
            {(field) => <Input {...field} {...register("house")} />}
          </FormField>
          <FormField label="Student status" error={errors.status?.message}>
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
                      {STUDENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s[0].toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parent / guardian</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Parent / guardian name" error={errors.guardianName?.message}>
            {(field) => <Input {...field} {...register("guardianName")} />}
          </FormField>
          <FormField label="Parent contact number" error={errors.guardianPhone?.message}>
            {(field) => <Input {...field} {...register("guardianPhone")} placeholder="+91 98XXXXXXXX" />}
          </FormField>
          <FormField label="Emergency contact number" error={errors.emergencyContact?.message}>
            {(field) => <Input {...field} {...register("emergencyContact")} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Address" className="sm:col-span-2" error={errors.address?.message}>
            {(field) => <Textarea {...field} {...register("address")} rows={2} />}
          </FormField>
          <FormField label="City" error={errors.city?.message}>
            {(field) => <Input {...field} {...register("city")} />}
          </FormField>
          <FormField label="State" error={errors.state?.message}>
            {(field) => <Input {...field} {...register("state")} />}
          </FormField>
          <FormField label="Country" error={errors.country?.message}>
            {(field) => <Input {...field} {...register("country")} />}
          </FormField>
          <FormField label="PIN code" error={errors.pinCode?.message}>
            {(field) => <Input {...field} {...register("pinCode")} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transport</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField label="Bus number" error={errors.busNumber?.message}>
            {(field) => <Input {...field} {...register("busNumber")} />}
          </FormField>
          <FormField label="Route" error={errors.route?.message}>
            {(field) => <Input {...field} {...register("route")} />}
          </FormField>
          <FormField label="Pickup point" error={errors.pickupPoint?.message}>
            {(field) => <Input {...field} {...register("pickupPoint")} />}
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
