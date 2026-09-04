"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { timingSetInputSchema, type TimingSetInput } from "@/lib/validation/timetable";
import { PERIOD_KINDS, PERIOD_KIND_LABELS } from "@/lib/constants/timetable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

type TimingSetFormValues = z.input<typeof timingSetInputSchema>;

const BLANK_PERIOD = { label: "", startTime: "", endTime: "", kind: "teaching" as const };

export function TimingSetForm({
  defaultValues,
  onSubmit,
  submitLabel = "Save timing set",
}: {
  defaultValues?: TimingSetInput;
  onSubmit: (input: TimingSetInput) => Promise<void>;
  submitLabel?: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TimingSetFormValues, unknown, TimingSetInput>({
    resolver: zodResolver(timingSetInputSchema),
    defaultValues: defaultValues ?? { name: "", periods: [{ ...BLANK_PERIOD, sortOrder: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "periods" });

  async function handleFormSubmit(values: TimingSetInput) {
    setServerError(null);
    try {
      // sortOrder follows row position — the reorder-by-dragging affordance is a fast-follow.
      await onSubmit({ ...values, periods: values.periods.map((p, i) => ({ ...p, sortOrder: i })) });
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

      <FormField label="Timing set name" required error={errors.name?.message}>
        {(f) => <Input {...f} {...register("name")} placeholder="Primary Timing" />}
      </FormField>

      <div className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-1 items-end gap-2 rounded-md border border-border p-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
            <FormField label="Label" error={errors.periods?.[index]?.label?.message}>
              {(f) => <Input {...f} {...register(`periods.${index}.label`)} placeholder="Period 1 / Break / Lunch" />}
            </FormField>
            <FormField label="Start" error={errors.periods?.[index]?.startTime?.message}>
              {(f) => <Input {...f} {...register(`periods.${index}.startTime`)} placeholder="08:20" />}
            </FormField>
            <FormField label="End" error={errors.periods?.[index]?.endTime?.message}>
              {(f) => <Input {...f} {...register(`periods.${index}.endTime`)} placeholder="09:00" />}
            </FormField>
            <FormField label="Kind">
              {(f) => (
                <Controller
                  name={`periods.${index}.kind`}
                  control={control}
                  render={({ field: kindField }) => (
                    <Select value={kindField.value} onValueChange={kindField.onChange}>
                      <SelectTrigger id={f.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIOD_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {PERIOD_KIND_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} disabled={fields.length <= 1}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {errors.periods?.message && <p className="text-xs font-medium text-danger-600">{errors.periods.message}</p>}

        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => append({ ...BLANK_PERIOD, sortOrder: fields.length })}>
          <Plus className="size-4" /> Add period
        </Button>
      </div>

      <Button type="submit" isLoading={isSubmitting} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
