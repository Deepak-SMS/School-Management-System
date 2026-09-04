"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { transportRouteInputSchema, type TransportRouteInput } from "@/lib/validation/transport-route";
import { ROUTE_STATUSES, ROUTE_STATUS_LABELS } from "@/lib/constants/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

type RouteFormValues = z.input<typeof transportRouteInputSchema>;

interface RouteFormProps {
  defaultValues?: Partial<TransportRouteInput>;
  onSubmit: (input: TransportRouteInput) => Promise<void>;
  submitLabel?: string;
}

export function RouteForm({ defaultValues, onSubmit, submitLabel = "Add route" }: RouteFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RouteFormValues, unknown, TransportRouteInput>({
    resolver: zodResolver(transportRouteInputSchema),
    defaultValues: { status: "active", ...defaultValues },
  });

  async function handleFormSubmit(values: TransportRouteInput) {
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
        <Alert variant="danger" title="Couldn't save route">
          {serverError}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Route details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register("name")} placeholder="Route 4 — Green Park" />}
          </FormField>
          <FormField label="Route number" error={errors.routeNumber?.message}>
            {(field) => <Input {...field} {...register("routeNumber")} placeholder="R-04" />}
          </FormField>
          <FormField label="Starting point" error={errors.startingPoint?.message}>
            {(field) => <Input {...field} {...register("startingPoint")} />}
          </FormField>
          <FormField label="Destination" error={errors.destination?.message}>
            {(field) => <Input {...field} {...register("destination")} placeholder="School" />}
          </FormField>
          <FormField label="Total distance (km)" error={errors.totalDistanceKm?.message}>
            {(field) => <Input {...field} {...register("totalDistanceKm")} type="number" step="0.1" />}
          </FormField>
          <FormField label="Estimated duration (minutes)" error={errors.estimatedDurationMinutes?.message}>
            {(field) => <Input {...field} {...register("estimatedDurationMinutes")} type="number" />}
          </FormField>
          <FormField label="Morning timing" error={errors.morningTiming?.message}>
            {(field) => <Input {...field} {...register("morningTiming")} placeholder="7:00 AM" />}
          </FormField>
          <FormField label="Afternoon timing" error={errors.afternoonTiming?.message}>
            {(field) => <Input {...field} {...register("afternoonTiming")} placeholder="3:30 PM" />}
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
                      {ROUTE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ROUTE_STATUS_LABELS[s]}
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

      <div className="flex justify-end gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
