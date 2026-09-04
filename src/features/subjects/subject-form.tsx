"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { subjectInputSchema, type SubjectInput } from "@/lib/validation/subject";

type SubjectFormValues = z.input<typeof subjectInputSchema>;
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS, SUBJECT_NATURE_TYPES } from "@/lib/constants/school";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

interface SubjectFormProps {
  defaultValues?: Partial<SubjectInput>;
  onSubmit: (input: SubjectInput) => Promise<void>;
  submitLabel?: string;
}

export function SubjectForm({ defaultValues, onSubmit, submitLabel = "Add subject" }: SubjectFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormValues, unknown, SubjectInput>({
    resolver: zodResolver(subjectInputSchema),
    defaultValues: { subjectType: "core", natureType: "theory", status: "active", ...defaultValues },
  });

  async function handleFormSubmit(values: SubjectInput) {
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
      {serverError && <Alert variant="danger" title="Couldn't save subject">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Subject details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Subject name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register("name")} placeholder="Mathematics" />}
          </FormField>
          <FormField label="Subject code" required error={errors.code?.message}>
            {(field) => <Input {...field} {...register("code")} placeholder="MATH-101" />}
          </FormField>
          <FormField label="Subject type" error={errors.subjectType?.message}>
            {(field) => (
              <Controller
                name="subjectType"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {SUBJECT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Theory / Practical" error={errors.natureType?.message}>
            {(field) => (
              <Controller
                name="natureType"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECT_NATURE_TYPES.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n[0].toUpperCase() + n.slice(1)}
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

      <div className="flex justify-end gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
