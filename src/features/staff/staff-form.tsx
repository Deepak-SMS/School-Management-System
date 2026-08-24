"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { staffInputSchema, type StaffInput } from "@/lib/validation/staff";

/** Pre-validation shape (e.g. `employmentStatus` optional before its zod `.default()` applies) — what the form fields actually hold. */
type StaffFormValues = z.input<typeof staffInputSchema>;
import { BLOOD_GROUPS, EMPLOYEE_TYPES, EMPLOYMENT_STATUSES, GENDERS, STAFF_CATEGORIES, STAFF_CATEGORY_LABELS } from "@/lib/constants/people";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

interface StaffFormProps {
  defaultValues?: Partial<StaffInput>;
  onSubmit: (input: StaffInput) => Promise<void>;
  submitLabel?: string;
}

export function StaffForm({ defaultValues, onSubmit, submitLabel = "Add staff member" }: StaffFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/departments?pageSize=100")
      .then((r) => r.json())
      .then((body) => setDepartments(body.data ?? []))
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues, unknown, StaffInput>({
    resolver: zodResolver(staffInputSchema),
    defaultValues: { employmentStatus: "active", category: "teacher", ...defaultValues },
  });

  async function handleFormSubmit(values: StaffInput) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const apiError = error as ApiError;
      setServerError(apiError?.error ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && <Alert variant="danger" title="Couldn't save staff member">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Employee ID" required error={errors.employeeId?.message}>
            {(field) => <Input {...field} {...register("employeeId")} placeholder="EMP009" />}
          </FormField>
          <FormField label="Full name" required error={errors.fullName?.message}>
            {(field) => <Input {...field} {...register("fullName")} placeholder="Priya Nair" />}
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
          <CardTitle>Employment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Category" required error={errors.category?.message}>
            {(field) => (
              <Controller
                name="category"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {STAFF_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Designation" required error={errors.designation?.message}>
            {(field) => <Input {...field} {...register("designation")} placeholder="Mathematics Teacher" />}
          </FormField>
          <FormField label="Department" error={errors.departmentId?.message}>
            {(field) => (
              <Controller
                name="departmentId"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Employee type" error={errors.employeeType?.message}>
            {(field) => (
              <Controller
                name="employeeType"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Joining date" error={errors.joiningDate?.message}>
            {(field) => <Input {...field} {...register("joiningDate")} type="date" />}
          </FormField>
          <FormField label="Employment status" error={errors.employmentStatus?.message}>
            {(field) => (
              <Controller
                name="employmentStatus"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_STATUSES.map((s) => (
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
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Mobile number" required error={errors.mobileNumber?.message}>
            {(field) => <Input {...field} {...register("mobileNumber")} placeholder="+91 90XXXXXXXX" />}
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            {(field) => <Input {...field} {...register("email")} type="email" />}
          </FormField>
          <FormField label="Emergency contact" error={errors.emergencyContact?.message}>
            {(field) => <Input {...field} {...register("emergencyContact")} />}
          </FormField>
          <FormField label="Address" className="sm:col-span-2" error={errors.address?.message}>
            {(field) => <Textarea {...field} {...register("address")} rows={2} />}
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
