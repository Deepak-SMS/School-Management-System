"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { transportVehicleInputSchema, type TransportVehicleInput } from "@/lib/validation/transport-vehicle";

type VehicleFormValues = z.input<typeof transportVehicleInputSchema>;
import { VEHICLE_TYPES, VEHICLE_TYPE_LABELS, FUEL_TYPES, FUEL_TYPE_LABELS, VEHICLE_STATUSES, VEHICLE_STATUS_LABELS } from "@/lib/constants/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

interface VehicleFormProps {
  defaultValues?: Partial<TransportVehicleInput>;
  onSubmit: (input: TransportVehicleInput) => Promise<void>;
  submitLabel?: string;
}

export function VehicleForm({ defaultValues, onSubmit, submitLabel = "Add vehicle" }: VehicleFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues, unknown, TransportVehicleInput>({
    resolver: zodResolver(transportVehicleInputSchema),
    defaultValues: { vehicleType: "bus", status: "active", ...defaultValues },
  });

  async function handleFormSubmit(values: TransportVehicleInput) {
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
      {serverError && <Alert variant="danger" title="Couldn't save vehicle">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Vehicle number" required error={errors.vehicleNumber?.message}>
            {(field) => <Input {...field} {...register("vehicleNumber")} placeholder="e.g. MH-04-AB-1234" />}
          </FormField>
          <FormField label="Vehicle type" error={errors.vehicleType?.message}>
            {(field) => (
              <Controller
                name="vehicleType"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {VEHICLE_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Make" error={errors.make?.message}>
            {(field) => <Input {...field} {...register("make")} placeholder="Tata" />}
          </FormField>
          <FormField label="Model" error={errors.modelName?.message}>
            {(field) => <Input {...field} {...register("modelName")} placeholder="Starbus" />}
          </FormField>
          <FormField label="Manufacturing year" error={errors.manufacturingYear?.message}>
            {(field) => <Input {...field} {...register("manufacturingYear")} type="number" placeholder="2022" />}
          </FormField>
          <FormField label="Color" error={errors.color?.message}>
            {(field) => <Input {...field} {...register("color")} />}
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
                      {VEHICLE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {VEHICLE_STATUS_LABELS[s]}
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
          <CardTitle>Capacity &amp; fuel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Seating capacity" error={errors.seatingCapacity?.message}>
            {(field) => <Input {...field} {...register("seatingCapacity")} type="number" placeholder="40" />}
          </FormField>
          <FormField label="Standing capacity" error={errors.standingCapacity?.message}>
            {(field) => <Input {...field} {...register("standingCapacity")} type="number" placeholder="0" />}
          </FormField>
          <FormField label="Fuel type" error={errors.fuelType?.message}>
            {(field) => (
              <Controller
                name="fuelType"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value ?? "none"} onValueChange={(v) => selectField.onChange(v === "none" ? undefined : v)}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select fuel type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {FUEL_TYPES.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FUEL_TYPE_LABELS[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="GPS device ID" description="Optional — for a future live-tracking integration." error={errors.gpsDeviceId?.message}>
            {(field) => <Input {...field} {...register("gpsDeviceId")} />}
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
