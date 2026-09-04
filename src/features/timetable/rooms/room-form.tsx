"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { roomInputSchema, type RoomInput } from "@/lib/validation/timetable";
import { ROOM_TYPES, ROOM_TYPE_LABELS } from "@/lib/constants/timetable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

type RoomFormValues = z.input<typeof roomInputSchema>;

export function RoomForm({
  defaultValues,
  onSubmit,
  submitLabel = "Add room",
}: {
  defaultValues?: Partial<RoomInput>;
  onSubmit: (input: RoomInput) => Promise<void>;
  submitLabel?: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RoomFormValues, unknown, RoomInput>({
    resolver: zodResolver(roomInputSchema),
    defaultValues: { roomType: "classroom", status: "active", ...defaultValues },
  });

  async function handleFormSubmit(values: RoomInput) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setServerError((error as ApiError)?.error ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
      {serverError && (
        <Alert variant="danger" role="alert">
          {serverError}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Room name" required error={errors.name?.message}>
          {(f) => <Input {...f} {...register("name")} placeholder="Room 101 / Computer Lab" />}
        </FormField>
        <FormField label="Room type" error={errors.roomType?.message}>
          {(f) => (
            <Controller
              name="roomType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={f.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ROOM_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <FormField label="Building" error={errors.buildingName?.message}>
          {(f) => <Input {...f} {...register("buildingName")} />}
        </FormField>
        <FormField label="Floor" error={errors.floor?.message}>
          {(f) => <Input {...f} {...register("floor")} />}
        </FormField>
        <FormField label="Capacity" error={errors.capacity?.message}>
          {(f) => <Input {...f} type="number" min={1} {...register("capacity")} />}
        </FormField>
      </div>

      <Button type="submit" isLoading={isSubmitting} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
