"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { campusInputSchema, type CampusInput } from "@/lib/validation/campus";

type CampusFormValues = z.input<typeof campusInputSchema>;
import { CAMPUS_TYPES, CAMPUS_TYPE_LABELS } from "@/lib/constants/school";
import { staffService } from "@/services/staffService";
import type { StaffRecord } from "@/types/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

interface CampusFormProps {
  defaultValues?: Partial<CampusInput>;
  onSubmit: (input: CampusInput) => Promise<void>;
  submitLabel?: string;
}

export function CampusForm({ defaultValues, onSubmit, submitLabel = "Add campus" }: CampusFormProps) {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CampusFormValues, unknown, CampusInput>({
    resolver: zodResolver(campusInputSchema),
    defaultValues: { campusType: "main", status: "active", ...defaultValues },
  });

  useEffect(() => {
    staffService.list({ pageSize: 200 }).then((res) => setStaff(res.data)).catch(() => {});
  }, []);

  async function handleFormSubmit(values: CampusInput) {
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
      {serverError && <Alert variant="danger" title="Couldn't save campus">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Campus name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register("name")} placeholder="Main Campus" />}
          </FormField>
          <FormField label="Campus code" required error={errors.code?.message}>
            {(field) => <Input {...field} {...register("code")} placeholder="MAIN-01" />}
          </FormField>
          <FormField label="Campus type" error={errors.campusType?.message}>
            {(field) => (
              <Controller
                name="campusType"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPUS_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {CAMPUS_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Campus head" error={errors.headStaffId?.message}>
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

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Address" className="sm:col-span-2" error={errors.address?.message}>
            {(field) => <Input {...field} {...register("address")} />}
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
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Phone" error={errors.phone?.message}>
            {(field) => <Input {...field} {...register("phone")} />}
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            {(field) => <Input {...field} {...register("email")} type="email" />}
          </FormField>
          <FormField label="Website" error={errors.website?.message}>
            {(field) => <Input {...field} {...register("website")} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capacity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Student capacity" error={errors.studentCapacity?.message}>
            {(field) => <Input {...field} {...register("studentCapacity")} type="number" min={1} />}
          </FormField>
          <FormField label="Staff capacity" error={errors.staffCapacity?.message}>
            {(field) => <Input {...field} {...register("staffCapacity")} type="number" min={1} />}
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
