"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import type { z } from "zod";
import { examCoreSchema, type ExamCoreInput, type ExamInput } from "@/lib/validation/exam";
import { EXAM_RESULT_TYPES, EXAM_RESULT_TYPE_LABELS, EXAM_STATUSES, EXAM_STATUS_LABELS } from "@/lib/constants/exam";
import { academicYearService } from "@/services/academicYearService";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import type { AcademicYearRecord } from "@/types/academicYear";
import type { ClassRecord } from "@/types/class";
import type { ExamClassEntry } from "@/types/exam";
import type { ExamTypeRecord } from "@/types/examType";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/loading-state";
import type { ApiError } from "@/services/studentService";

type ExamFormValues = z.input<typeof examCoreSchema>;

/** Passed to `onSubmit` only when the "Publish notification in News" toggle was on. */
export interface ExamNewsAnnouncement {
  description: string;
}

interface ExamFormProps {
  defaultValues?: Partial<ExamCoreInput>;
  defaultClasses?: ExamClassEntry[];
  onSubmit: (input: ExamInput, announcement?: ExamNewsAnnouncement) => Promise<void>;
  submitLabel?: string;
}

export function ExamForm({ defaultValues, defaultClasses = [], onSubmit, submitLabel = "Create exam" }: ExamFormProps) {
  const isCreate = !defaultValues;
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [examTypes, setExamTypes] = useState<ExamTypeRecord[] | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [pickerClassId, setPickerClassId] = useState("");
  const [pickerSectionId, setPickerSectionId] = useState("");
  const [examClasses, setExamClasses] = useState<ExamClassEntry[]>(defaultClasses);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [publishNews, setPublishNews] = useState(false);
  const [newsDescription, setNewsDescription] = useState("");
  const [newsDescriptionError, setNewsDescriptionError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExamFormValues, unknown, ExamCoreInput>({
    resolver: zodResolver(examCoreSchema),
    defaultValues: { resultType: "marks", status: "draft", ...defaultValues },
  });

  useEffect(() => {
    academicYearService.list({ pageSize: 50 }).then((r) => {
      setAcademicYears(r.data);
      if (isCreate) {
        const active = r.data.find((y) => y.status === "active");
        if (active) setValue("academicYearId", active.id, { shouldValidate: true });
      }
    }).catch(() => {});
    classService.list({ pageSize: 200 }).then((r) => setClasses(r.data)).catch(() => {});
    fetch("/api/exam-types")
      .then((r) => r.json())
      .then((body) => setExamTypes((body.data as ExamTypeRecord[])?.filter((t) => t.status === "active") ?? []))
      .catch(() => setExamTypes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pickerClassId) return;
    sectionService.list({ classId: pickerClassId, pageSize: 100, status: "active" }).then((r) => setSections(r.data));
  }, [pickerClassId]);

  function addExamClass() {
    if (!pickerClassId) return;
    const cls = classes.find((c) => c.id === pickerClassId);
    if (!cls) return;
    const section = sections.find((s) => s.id === pickerSectionId);
    const key = `${cls.id}-${section?.id ?? "all"}`;
    if (examClasses.some((t) => `${t.classId}-${t.sectionId ?? "all"}` === key)) return;
    setExamClasses((prev) => [...prev, { classId: cls.id, className: cls.name, sectionId: section?.id, sectionName: section?.name }]);
    setClassesError(null);
    setPickerClassId("");
    setPickerSectionId("");
  }

  function removeExamClass(index: number) {
    setExamClasses((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFormSubmit(values: ExamCoreInput) {
    setServerError(null);
    setDuplicateMessage(null);
    if (examClasses.length === 0) {
      setClassesError("Select at least one class this exam applies to.");
      return;
    }
    if (publishNews && !newsDescription.trim()) {
      setNewsDescriptionError("Write a short description for the News announcement.");
      return;
    }
    try {
      await onSubmit(
        {
          ...values,
          classes: examClasses.map((c) => ({ classId: c.classId, sectionId: c.sectionId ?? undefined })),
        },
        publishNews ? { description: newsDescription.trim() } : undefined,
      );
    } catch (error) {
      const apiError = error as ApiError;
      const message = apiError?.error ?? "Something went wrong. Please try again.";
      if (typeof apiError?.error === "string" && apiError.error.includes("already exists for")) {
        setDuplicateMessage(message);
      } else {
        setServerError(message);
      }
    }
  }

  if (!examTypes) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5 text-primary-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && <Alert variant="danger" title="Couldn't save exam">{serverError}</Alert>}
      {duplicateMessage && <Alert variant="danger" title="Exam already exists">{duplicateMessage}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Exam details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Exam name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register("name")} placeholder="Quarter 1 Examination" />}
          </FormField>
          <FormField label="Exam code" required error={errors.code?.message}>
            {(field) => <Input {...field} {...register("code")} placeholder="Q1-2026" />}
          </FormField>
          <FormField label="Academic year" required error={errors.academicYearId?.message}>
            {(field) => (
              <Controller
                name="academicYearId"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Exam type" required error={errors.examTypeId?.message} description={examTypes.length === 0 ? "No exam types yet — add one under Exam Types first." : undefined}>
            {(field) => (
              <Controller
                name="examTypeId"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange} disabled={examTypes.length === 0}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select exam type" />
                    </SelectTrigger>
                    <SelectContent>
                      {examTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Term" error={errors.term?.message} description="Free text for now, e.g. Term 1">
            {(field) => <Input {...field} {...register("term")} placeholder="Term 1" />}
          </FormField>
          <FormField label="Result type" required>
            {(field) => (
              <Controller
                name="resultType"
                control={control}
                render={({ field: selectField }) => (
                  <Select value={selectField.value} onValueChange={selectField.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAM_RESULT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {EXAM_RESULT_TYPE_LABELS[t]}
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
          <FormField label="Result date" error={errors.resultDate?.message}>
            {(field) => <Input {...field} {...register("resultDate")} type="date" />}
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
                      {EXAM_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {EXAM_STATUS_LABELS[s]}
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
          <CardTitle>Applicable classes &amp; sections</CardTitle>
          <CardDescription>Pick a class, optionally narrow to one section, and add it. Leave the section as &quot;All sections&quot; to apply the exam to every section of that class.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Class</span>
              <Select
                value={pickerClassId || "none"}
                onValueChange={(v) => {
                  const next = v === "none" ? "" : v;
                  setPickerClassId(next);
                  setPickerSectionId("");
                  if (!next) setSections([]);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select class</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Section (optional)</span>
              <Select value={pickerSectionId || "all"} onValueChange={(v) => setPickerSectionId(v === "all" ? "" : v)} disabled={!pickerClassId}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addExamClass} disabled={!pickerClassId}>
              Add
            </Button>
          </div>
          {classesError && <p className="text-sm text-danger-600">{classesError}</p>}
          {examClasses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {examClasses.map((t, i) => (
                <Badge key={`${t.classId}-${t.sectionId ?? "all"}`} variant="primary" className="gap-1.5">
                  {t.className}
                  {t.sectionName ? `-${t.sectionName}` : " (all sections)"}
                  <button type="button" onClick={() => removeExamClass(i)} aria-label="Remove">
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Notify</CardTitle>
            <CardDescription>Optionally announce this exam in News once it&apos;s created — visible under News Management, scoped to the classes above.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Publish notification in News">
              {() => <Switch checked={publishNews} onCheckedChange={setPublishNews} />}
            </FormField>
            {publishNews && (
              <FormField label="Description" required error={newsDescriptionError ?? undefined}>
                {(field) => (
                  <Textarea
                    {...field}
                    value={newsDescription}
                    onChange={(e) => {
                      setNewsDescription(e.target.value);
                      setNewsDescriptionError(null);
                    }}
                    placeholder="e.g. Quarter 1 Examination begins 1 September — check the schedule under Examination."
                    rows={3}
                  />
                )}
              </FormField>
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
