"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { academicYearInputSchema, type AcademicYearInput, type CopyConfigInput } from "@/lib/validation/academicYear";

type AcademicYearFormValues = z.input<typeof academicYearInputSchema>;
import { ACADEMIC_YEAR_STATUSES } from "@/lib/constants/school";
import { academicYearService } from "@/services/academicYearService";
import type { AcademicYearRecord } from "@/types/academicYear";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

interface AcademicYearFormProps {
  defaultValues?: Partial<AcademicYearInput>;
  onSubmit: (input: AcademicYearInput, copyConfig?: CopyConfigInput) => Promise<void>;
  submitLabel?: string;
  allowCopy?: boolean;
}

export function AcademicYearForm({ defaultValues, onSubmit, submitLabel = "Add academic year", allowCopy = false }: AcademicYearFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [existingYears, setExistingYears] = useState<AcademicYearRecord[]>([]);
  const [copyFromId, setCopyFromId] = useState<string>("");
  const [copyClasses, setCopyClasses] = useState(true);
  const [copySections, setCopySections] = useState(true);
  const [copySubjects, setCopySubjects] = useState(true);
  const [copyTeacherAssignments, setCopyTeacherAssignments] = useState(true);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AcademicYearFormValues, unknown, AcademicYearInput>({
    resolver: zodResolver(academicYearInputSchema),
    defaultValues: { status: "draft", ...defaultValues },
  });

  useEffect(() => {
    if (!allowCopy) return;
    academicYearService.list({ pageSize: 50 }).then((res) => setExistingYears(res.data)).catch(() => {});
  }, [allowCopy]);

  async function handleFormSubmit(values: AcademicYearInput) {
    setServerError(null);
    try {
      const copyConfig: CopyConfigInput | undefined = copyFromId
        ? { sourceAcademicYearId: copyFromId, copyClasses, copySections, copySubjects, copyTeacherAssignments }
        : undefined;
      await onSubmit(values, copyConfig);
    } catch (error) {
      const apiError = error as ApiError;
      setServerError(apiError?.error ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && <Alert variant="danger" title="Couldn't save academic year">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Academic year details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Academic year name" required error={errors.label?.message}>
            {(field) => <Input {...field} {...register("label")} placeholder="2027-28" />}
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
                      {ACADEMIC_YEAR_STATUSES.map((s) => (
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
          <FormField label="Start date" required error={errors.startDate?.message}>
            {(field) => <Input {...field} {...register("startDate")} type="date" />}
          </FormField>
          <FormField label="End date" required error={errors.endDate?.message}>
            {(field) => <Input {...field} {...register("endDate")} type="date" />}
          </FormField>
          <FormField label="Admission start date" error={errors.admissionStartDate?.message}>
            {(field) => <Input {...field} {...register("admissionStartDate")} type="date" />}
          </FormField>
          <FormField label="Admission end date" error={errors.admissionEndDate?.message}>
            {(field) => <Input {...field} {...register("admissionEndDate")} type="date" />}
          </FormField>
          <FormField label="Promotion date" error={errors.promotionDate?.message}>
            {(field) => <Input {...field} {...register("promotionDate")} type="date" />}
          </FormField>
          <FormField label="Result publication date" error={errors.resultPublicationDate?.message}>
            {(field) => <Input {...field} {...register("resultPublicationDate")} type="date" />}
          </FormField>
        </CardContent>
      </Card>

      {allowCopy && existingYears.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Copy configuration from previous academic year</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Copy from">
              {(field) => (
                <Select value={copyFromId || "none"} onValueChange={(v) => setCopyFromId(v === "none" ? "" : v)}>
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder="Don't copy anything" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Don&apos;t copy anything</SelectItem>
                    {existingYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            {copyFromId && (
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={copyClasses} onCheckedChange={(v) => setCopyClasses(v === true)} /> Classes
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={copySections} onCheckedChange={(v) => setCopySections(v === true)} disabled={!copyClasses} />
                  Sections
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={copySubjects} onCheckedChange={(v) => setCopySubjects(v === true)} disabled={!copyClasses} />
                  Subjects (class/section assignments)
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={copyTeacherAssignments}
                    onCheckedChange={(v) => setCopyTeacherAssignments(v === true)}
                    disabled={!copySubjects}
                  />
                  Teacher assignments
                </label>
                <p className="text-xs text-muted-foreground">
                  Students are never copied automatically — promote or re-enroll them separately once this year is active.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
