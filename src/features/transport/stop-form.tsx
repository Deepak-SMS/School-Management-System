"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { transportStopInputSchema, type TransportStopInput } from "@/lib/validation/transport-stop";
import { STOP_STATUSES, STOP_STATUS_LABELS } from "@/lib/constants/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

type StopFormValues = z.input<typeof transportStopInputSchema>;

interface StopFormProps {
  defaultValues?: Partial<TransportStopInput>;
  onSubmit: (input: TransportStopInput) => Promise<void>;
  submitLabel?: string;
}

export function StopForm({ defaultValues, onSubmit, submitLabel = "Add stop" }: StopFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StopFormValues, unknown, TransportStopInput>({
    resolver: zodResolver(transportStopInputSchema),
    defaultValues: { status: "active", ...defaultValues },
  });

  async function handleFormSubmit(values: TransportStopInput) {
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
      {serverError && (
        <Alert variant="danger" title="Couldn't save stop">
          {serverError}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stop details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" required error={errors.name?.message} className="sm:col-span-2">
            {(field) => <Input {...field} {...register("name")} placeholder="e.g. Green Park Society" />}
          </FormField>
          <FormField label="Code" error={errors.code?.message}>
            {(field) => <Input {...field} {...register("code")} placeholder="ST-04" />}
          </FormField>
          <FormField label="Distance from school (km)" error={errors.distanceFromSchool?.message}>
            {(field) => <Input {...field} {...register("distanceFromSchool")} type="number" step="0.1" />}
          </FormField>
          <FormField label="Address" className="sm:col-span-2" error={errors.address?.message}>
            {(field) => <Input {...field} {...register("address")} />}
          </FormField>
          <FormField label="Landmark" error={errors.landmark?.message}>
            {(field) => <Input {...field} {...register("landmark")} />}
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
                      {STOP_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STOP_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Latitude" error={errors.latitude?.message}>
            {(field) => <Input {...field} {...register("latitude")} type="number" step="0.000001" />}
          </FormField>
          <FormField label="Longitude" error={errors.longitude?.message}>
            {(field) => <Input {...field} {...register("longitude")} type="number" step="0.000001" />}
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
