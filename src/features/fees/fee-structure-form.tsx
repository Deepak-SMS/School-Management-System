"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller, useFieldArray, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { feeStructureInputSchema, type FeeStructureInput } from "@/lib/validation/fee-structure";
import { FEE_FREQUENCIES, FEE_FREQUENCY_LABELS } from "@/lib/constants/fees";
import { academicYearService } from "@/services/academicYearService";
import { classService } from "@/services/classService";
import { sectionService } from "@/services/sectionService";
import { feeCategoryService, feeStudentCategoryService, lateFeeRuleService } from "@/services/feeStructureService";
import type { AcademicYearRecord } from "@/types/academicYear";
import type { ClassRecord } from "@/types/class";
import type { SectionRecord } from "@/types/section";
import type { FeeCategoryRecord, FeeStudentCategoryRecord, LateFeeRuleRecord } from "@/types/fees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/loading-state";
import type { ApiError } from "@/services/studentService";

type FormValues = z.input<typeof feeStructureInputSchema>;

const EMPTY_ITEM: FormValues["items"][number] = {
  feeCategoryId: "",
  amount: 0,
  frequency: "one_time",
  isOptional: false,
  lateFeeRuleId: "",
  installments: [],
};

interface FeeStructureFormProps {
  defaultValues?: Partial<FeeStructureInput>;
  onSubmit: (input: FeeStructureInput) => Promise<void>;
  submitLabel?: string;
  /** True once the structure has ever been published — targeting and items are then read-only; only name/description stay editable. See PATCH /api/fee-structures/[id]. */
  locked?: boolean;
}

export function FeeStructureForm({ defaultValues, onSubmit, submitLabel = "Create fee structure", locked = false }: FeeStructureFormProps) {
  const isCreate = !defaultValues;
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [studentCategories, setStudentCategories] = useState<FeeStudentCategoryRecord[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategoryRecord[] | null>(null);
  const [lateFeeRules, setLateFeeRules] = useState<LateFeeRuleRecord[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues, unknown, FeeStructureInput>({
    resolver: zodResolver(feeStructureInputSchema),
    defaultValues: { items: [EMPTY_ITEM], ...defaultValues },
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const academicYearId = useWatch({ control, name: "academicYearId" }) as string | undefined;
  const classId = useWatch({ control, name: "classId" }) as string | undefined;
  // Independent of `classId` itself so unchecking it can re-enable the Class
  // picker without first needing a value to clear — see handleApplyToAllClassesChange.
  const [applyToAllClasses, setApplyToAllClasses] = useState(!defaultValues?.classId);

  function handleApplyToAllClassesChange(checked: boolean) {
    setApplyToAllClasses(checked);
    if (checked) {
      setValue("classId", "", { shouldValidate: true });
      setValue("sectionId", "", { shouldValidate: true });
    }
  }

  useEffect(() => {
    academicYearService.list({ pageSize: 50 }).then((r) => {
      setAcademicYears(r.data);
      // Rule: new records default into the active academic year, so data
      // never lands in a draft/archived year by accident — same precedent
      // class-form.tsx follows. Only applies when creating.
      if (isCreate) {
        const active = r.data.find((y) => y.status === "active");
        if (active) setValue("academicYearId", active.id, { shouldValidate: true });
      }
    }).catch(() => {});
    feeStudentCategoryService.list({ status: "active" }).then((r) => setStudentCategories(r.data)).catch(() => {});
    feeCategoryService.list({ status: "active" }).then((r) => setFeeCategories(r.data)).catch(() => setFeeCategories([]));
    lateFeeRuleService.list({ status: "active" }).then((r) => setLateFeeRules(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!academicYearId) return;
    classService.list({ academicYearId, pageSize: 100 }).then((r) => setClasses(r.data)).catch(() => setClasses([]));
  }, [academicYearId]);
  // Stale classes from a previous academic year never render once it's cleared — see the `classes` usage below.
  const visibleClasses = academicYearId ? classes : [];

  useEffect(() => {
    if (!classId) return;
    sectionService.list({ classId, pageSize: 100 }).then((r) => setSections(r.data)).catch(() => setSections([]));
  }, [classId]);
  const visibleSections = classId ? sections : [];

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const itemsErrorObject = errors.items as unknown as { message?: string; root?: { message?: string } } | undefined;
  const itemsErrorMessage = itemsErrorObject?.message ?? itemsErrorObject?.root?.message;

  async function handleFormSubmit(values: FeeStructureInput) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setServerError((error as ApiError)?.error ?? "Something went wrong. Please try again.");
    }
  }

  if (!feeCategories) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5 text-primary-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && <Alert variant="danger" title="Couldn't save fee structure">{serverError}</Alert>}

      {locked && (
        <Alert variant="info">
          This structure has been published, so its fee items and targeting are locked to protect students already
          assigned to it. Duplicate it to make changes.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Structure details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" required error={errors.name?.message} className="sm:col-span-2">
            {(f) => <Input {...f} {...register("name")} placeholder="Class 10 — Annual Fee 2026-27" />}
          </FormField>
          <FormField label="Description" className="sm:col-span-2">
            {(f) => <Textarea {...f} rows={2} {...register("description")} />}
          </FormField>

          <SelectField
            control={control}
            name="academicYearId"
            label="Academic year"
            required
            disabled={locked}
            placeholder="Select academic year"
            error={errors.academicYearId?.message}
            options={academicYears.map((y) => ({ value: y.id, label: y.label }))}
          />
          <SelectField
            control={control}
            name="studentCategoryId"
            label="Student category"
            disabled={locked}
            placeholder="Applies to every category"
            options={studentCategories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectField
            control={control}
            name="classId"
            label="Class"
            disabled={locked || !academicYearId || applyToAllClasses}
            placeholder={academicYearId ? "Applies to every class" : "Pick an academic year first"}
            options={visibleClasses.map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectField
            control={control}
            name="sectionId"
            label="Section"
            disabled={locked || !classId || applyToAllClasses}
            placeholder={classId ? "Applies to every section" : "Pick a class first"}
            error={errors.sectionId?.message}
            options={visibleSections.map((s) => ({ value: s.id, label: s.name }))}
          />
          {academicYearId && !applyToAllClasses && visibleClasses.length === 0 && (
            <p className="text-xs text-warning-600 sm:col-span-2 -mt-2">
              No classes exist yet for this academic year — create them under School Management before targeting one here.
            </p>
          )}
          {classId && visibleSections.length === 0 && (
            <p className="text-xs text-warning-600 sm:col-span-2 -mt-2">This class has no sections yet.</p>
          )}

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={applyToAllClasses} onCheckedChange={handleApplyToAllClassesChange} disabled={locked} />
            Apply to every class
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Leave student category unset to apply this structure to every category. Class and section work the same way — check the box above,
            or just leave them unset, to apply everywhere.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Fee items</CardTitle>
          {!locked && (
            <Button type="button" variant="secondary" size="sm" onClick={() => append(EMPTY_ITEM)}>
              <Plus className="size-4" /> Add fee item
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {itemsErrorMessage && <Alert variant="danger">{itemsErrorMessage}</Alert>}
          {feeCategories.length === 0 && (
            <Alert variant="warning">
              You haven&apos;t added any fee categories yet — add one from the Fee Categories tab before building a fee item.
            </Alert>
          )}

          {fields.map((field, index) => (
            <FeeItemFields
              key={field.id}
              control={control}
              index={index}
              locked={locked}
              feeCategories={feeCategories}
              lateFeeRules={lateFeeRules}
              onRemove={fields.length > 1 ? () => remove(index) : undefined}
            />
          ))}

          <FeeStructureTotal control={control} />
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

function FeeItemFields({
  control,
  index,
  locked,
  feeCategories,
  lateFeeRules,
  onRemove,
}: {
  control: Control<FormValues>;
  index: number;
  locked: boolean;
  feeCategories: FeeCategoryRecord[];
  lateFeeRules: LateFeeRuleRecord[];
  onRemove?: () => void;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `items.${index}.installments` });
  const amount = useWatch({ control, name: `items.${index}.amount` }) as number | string | undefined;
  const installments = useWatch({ control, name: `items.${index}.installments` }) as
    | { amount?: number | string }[]
    | undefined;

  const installmentTotal = useMemo(
    () => (installments ?? []).reduce((sum, i) => sum + (Number(i?.amount) || 0), 0),
    [installments],
  );
  const mismatch = (installments?.length ?? 0) > 0 && Math.abs(installmentTotal - (Number(amount) || 0)) >= 0.01;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <SelectField
          control={control}
          name={`items.${index}.feeCategoryId`}
          label="Fee category"
          required
          disabled={locked}
          placeholder="Select fee category"
          options={feeCategories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FormField label="Amount" required>
          {(f) => (
            <Controller
              control={control}
              name={`items.${index}.amount`}
              render={({ field }) => (
                <Input
                  {...f}
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={locked}
                  value={(field.value as number | string | undefined) ?? ""}
                  onChange={field.onChange}
                />
              )}
            />
          )}
        </FormField>
        <SelectField
          control={control}
          name={`items.${index}.frequency`}
          label="Frequency"
          disabled={locked}
          options={FEE_FREQUENCIES.map((f) => ({ value: f, label: FEE_FREQUENCY_LABELS[f] }))}
        />
        <SelectField
          control={control}
          name={`items.${index}.lateFeeRuleId`}
          label="Late fee rule"
          disabled={locked}
          placeholder="None"
          options={lateFeeRules.map((r) => ({ value: r.id, label: r.name }))}
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Controller
            control={control}
            name={`items.${index}.isOptional`}
            render={({ field }) => (
              <Checkbox checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={locked} />
            )}
          />
          Optional fee (e.g. transport — only for students who opt in)
        </label>
        {onRemove && !locked && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="size-4" /> Remove item
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Installment schedule <span className="font-normal">(optional — leave empty to bill the full amount at once)</span>
          </p>
          {!locked && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => append({ label: `Installment ${fields.length + 1}`, dueDate: "", amount: 0 })}
            >
              <Plus className="size-4" /> Add installment
            </Button>
          )}
        </div>

        {fields.map((field, instIndex) => (
          <div key={field.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-end gap-2">
            <FormField label="Label">
              {(f) => (
                <Controller
                  control={control}
                  name={`items.${index}.installments.${instIndex}.label`}
                  render={({ field: labelField }) => (
                    <Input {...f} disabled={locked} {...labelField} placeholder="Term 1" />
                  )}
                />
              )}
            </FormField>
            <FormField label="Due date">
              {(f) => (
                <Controller
                  control={control}
                  name={`items.${index}.installments.${instIndex}.dueDate`}
                  render={({ field: dateField }) => <Input {...f} type="date" disabled={locked} {...dateField} />}
                />
              )}
            </FormField>
            <FormField label="Amount">
              {(f) => (
                <Controller
                  control={control}
                  name={`items.${index}.installments.${instIndex}.amount`}
                  render={({ field: amtField }) => (
                    <Input
                      {...f}
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={locked}
                      value={(amtField.value as number | string | undefined) ?? ""}
                      onChange={amtField.onChange}
                    />
                  )}
                />
              )}
            </FormField>
            {!locked && (
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(instIndex)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}

        {mismatch && (
          <p className="text-xs text-danger-600">
            Installments add up to {installmentTotal} but the item amount is {String(amount ?? 0)} — these must match.
          </p>
        )}
      </div>
    </div>
  );
}

function FeeStructureTotal({ control }: { control: Control<FormValues> }) {
  const items = useWatch({ control, name: "items" });
  const total = (items ?? []).reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);

  return (
    <div className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2 text-sm">
      <span className="text-muted-foreground">Total per student, across every item</span>
      <span className="font-semibold text-foreground">₹{total.toLocaleString("en-IN")}</span>
    </div>
  );
}

/** Controller + Select, which every dropdown here needs identically. */
function SelectField({
  control,
  name,
  label,
  options,
  placeholder,
  error,
  required,
  disabled,
}: {
  control: Control<FormValues>;
  // Item/installment paths are indexed, so this is deliberately wider than a plain top-level key.
  name: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <FormField label={label} required={required} error={error}>
      {(f) => (
        <Controller
          name={name as never}
          control={control}
          render={({ field }) => (
            <Select value={(field.value as string) ?? ""} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger id={f.id}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}
    </FormField>
  );
}
