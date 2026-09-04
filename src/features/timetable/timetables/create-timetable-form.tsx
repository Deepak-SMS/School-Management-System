"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { timetableInputSchema, type TimetableInput } from "@/lib/validation/timetable";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/constants/school";
import { academicYearService } from "@/services/academicYearService";
import { classService } from "@/services/classService";
import { timetableService } from "@/services/timetableService";
import type { AcademicYearRecord } from "@/types/academicYear";
import type { ClassRecord } from "@/types/class";
import type { TimingSetRecord } from "@/types/timetable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

type TimetableFormValues = z.input<typeof timetableInputSchema>;

export function CreateTimetableForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [timingSets, setTimingSets] = useState<TimingSetRecord[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TimetableFormValues, unknown, TimetableInput>({
    resolver: zodResolver(timetableInputSchema),
    defaultValues: { workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"], classes: [] },
  });

  useEffect(() => {
    academicYearService.list({ pageSize: 50 }).then((r) => {
      setAcademicYears(r.data);
      const current = r.data.find((y) => y.status === "active") ?? r.data[0];
      if (current) setValue("academicYearId", current.id);
    });
    classService.list({ pageSize: 100, status: "active" }).then((r) => setClasses(r.data));
    timetableService.listTimingSets().then((r) => {
      setTimingSets(r.data);
      if (r.data[0]) setValue("timingSetId", r.data[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedClasses = watch("classes") ?? [];
  const selectedWorkingDays = watch("workingDays") ?? [];

  function toggleClass(classId: string) {
    const exists = selectedClasses.some((c) => c.classId === classId);
    setValue(
      "classes",
      exists ? selectedClasses.filter((c) => c.classId !== classId) : [...selectedClasses, { classId }],
      { shouldValidate: true },
    );
  }

  function toggleWorkingDay(day: (typeof WEEKDAYS)[number]) {
    setValue(
      "workingDays",
      selectedWorkingDays.includes(day) ? selectedWorkingDays.filter((d) => d !== day) : [...selectedWorkingDays, day],
      { shouldValidate: true },
    );
  }

  async function handleFormSubmit(values: TimetableInput) {
    setServerError(null);
    try {
      const created = await timetableService.createTimetable(values);
      onCreated(created.id);
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

      <FormField label="Timetable name" required error={errors.name?.message}>
        {(f) => <Input {...f} {...register("name")} placeholder="Regular Timetable 2026-27" />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Academic year" required error={errors.academicYearId?.message}>
          {(f) => (
            <Controller
              name="academicYearId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={f.id}>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <FormField label="Timing set" required error={errors.timingSetId?.message}>
          {(f) => (
            <Controller
              name="timingSetId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={timingSets.length === 0}>
                  <SelectTrigger id={f.id}>
                    <SelectValue placeholder={timingSets.length === 0 ? "Add a timing set first" : "Select timing set"} />
                  </SelectTrigger>
                  <SelectContent>
                    {timingSets.map((ts) => (
                      <SelectItem key={ts.id} value={ts.id}>
                        {ts.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <FormField label="Start date" required error={errors.startDate?.message}>
          {(f) => <Input {...f} type="date" {...register("startDate")} />}
        </FormField>
        <FormField label="End date" required error={errors.endDate?.message}>
          {(f) => <Input {...f} type="date" {...register("endDate")} />}
        </FormField>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Working days</label>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.slice(0, 6).map((day) => (
            <label key={day} className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={selectedWorkingDays.includes(day)} onCheckedChange={() => toggleWorkingDay(day)} />
              {WEEKDAY_LABELS[day]}
            </label>
          ))}
        </div>
        {errors.workingDays?.message && <p className="text-xs font-medium text-danger-600">{errors.workingDays.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Classes covered</label>
        <div className="flex flex-wrap gap-3 rounded-md border border-border p-3">
          {classes.map((cls) => (
            <label key={cls.id} className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={selectedClasses.some((c) => c.classId === cls.id)} onCheckedChange={() => toggleClass(cls.id)} />
              {cls.name}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Every section of a selected class is included — remove individual sections later from the timetable&apos;s Classes tab.</p>
        {errors.classes?.message && <p className="text-xs font-medium text-danger-600">{errors.classes.message}</p>}
      </div>

      <Button type="submit" isLoading={isSubmitting} className="self-start">
        Create timetable
      </Button>
    </form>
  );
}
