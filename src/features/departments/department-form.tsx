"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { departmentInputSchema, type DepartmentInput } from "@/lib/validation/department";

type DepartmentFormValues = z.input<typeof departmentInputSchema>;
import { DEPARTMENT_TYPES, DEPARTMENT_TYPE_LABELS } from "@/lib/constants/school";
import { staffService } from "@/services/staffService";
import { campusService } from "@/services/campusService";
import type { StaffRecord } from "@/types/staff";
import type { CampusRecord } from "@/types/campus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

interface DepartmentFormProps {
  defaultValues?: Partial<DepartmentInput>;
  onSubmit: (input: DepartmentInput) => Promise<void>;
  submitLabel?: string;
}

export function DepartmentForm({ defaultValues, onSubmit, submitLabel = "Add department" }: DepartmentFormProps) {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [campuses, setCampuses] = useState<CampusRecord[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormValues, unknown, DepartmentInput>({
    resolver: zodResolver(departmentInputSchema),
    defaultValues: { departmentType: "academic", status: "active", ...defaultValues },
  });

  useEffect(() => {
    staffService.list({ pageSize: 200 }).then((res) => setStaff(res.data)).catch(() => {});
    campusService.list({ pageSize: 100 }).then((res) => setCampuses(res.data)).catch(() => {});
  }, []);

  async function handleFormSubmit(values: DepartmentInput) {
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
      {serverError && <Alert variant="danger" title="Couldn't save department">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Department name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register("name")} placeholder="Mathematics" />}
          </FormField>
          <FormField label="Department code" required error={errors.code?.message}>
            {(field) => <Input {...field} {...register("code")} placeholder="DEPT-MATH" />}
          </FormField>
          <FormField label="Department type" error={errors.departmentType?.message}>
            {(field) => (
              <Controller
                name="departmentType"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {DEPARTMENT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Department head" error={errors.headStaffId?.message}>
            {(field) => (
              <Controller
                name="headStaffId"
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
          <FormField label="Campus" error={errors.campusId?.message}>
            {(field) => (
              <Controller
                name="campusId"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="All campuses" />
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
          <FormField label="Description" className="sm:col-span-2" error={errors.description?.message}>
            {(field) => <Textarea {...field} {...register("description")} rows={2} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" error={errors.email?.message}>
            {(field) => <Input {...field} {...register("email")} type="email" />}
          </FormField>
          <FormField label="Phone" error={errors.phone?.message}>
            {(field) => <Input {...field} {...register("phone")} />}
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
