"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller, useFieldArray, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { studentInputSchema, type StudentInput } from "@/lib/validation/student";
import { BLOOD_GROUPS, GENDERS, STUDENT_STATUSES } from "@/lib/constants/people";
import {
  ADMISSION_TYPES,
  ADMISSION_TYPE_LABELS,
  PROMOTION_STATUSES,
  PROMOTION_STATUS_LABELS,
  MEDIUM_SUGGESTIONS,
  STREAM_SUGGESTIONS,
} from "@/lib/constants/student-documents";
import { schoolStructureService } from "@/services/schoolStructureService";
import type { SchoolStructure } from "@/types/student";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

type StudentFormValues = z.input<typeof studentInputSchema>;
type Form = UseFormReturn<StudentFormValues, unknown, StudentInput>;

interface StepDef {
  id: string;
  title: string;
  fields: (keyof StudentFormValues)[];
}

/**
 * The admission form, in the order an office actually fills it in.
 *
 * Documents are absent from the wizard on purpose: they're uploaded against a
 * saved student from the profile, so a stack of files is never held against a
 * record that may never be created.
 */
const STEPS: StepDef[] = [
  {
    id: "student",
    title: "Student",
    fields: [
      "admissionNumber", "enrollmentNumber", "firstName", "middleName", "lastName",
      "dateOfBirth", "gender", "bloodGroup", "nationality", "motherTongue", "category", "religion", "govtIdRef",
    ],
  },
  {
    id: "admission",
    title: "Admission",
    fields: [
      "previousSchool", "previousClass", "admissionDate", "admissionType",
      "academicYearId", "classId", "sectionId", "rollNumber", "house", "stream", "medium", "promotionStatus", "status",
    ],
  },
  { id: "parents", title: "Parents & guardians", fields: ["guardians"] },
  {
    id: "address",
    title: "Address & contact",
    fields: [
      "address", "addressLine2", "city", "district", "state", "country", "pinCode",
      "sameAsCurrent", "permanentAddress", "permanentCity", "permanentDistrict", "permanentState", "permanentPinCode",
      "primaryMobile", "secondaryMobile", "studentEmail", "parentEmail", "whatsappNumber",
    ],
  },
  {
    id: "emergency",
    title: "Emergency",
    fields: ["emergencyName", "emergencyRelation", "emergencyContact", "emergencyAltPhone", "emergencyAddress"],
  },
];

/** The three blocks the admission form asks for, pre-seeded so they're just fill-in. */
const DEFAULT_GUARDIANS: StudentFormValues["guardians"] = [
  { relationship: "father", fullName: "", isPrimary: true, isEmergencyContact: true, isAuthorizedPickup: true },
  { relationship: "mother", fullName: "", isAuthorizedPickup: true },
];

export function StudentForm({
  defaultValues,
  onSubmit,
  submitLabel = "Add student",
  mode = "create",
}: {
  defaultValues?: Partial<StudentInput>;
  onSubmit: (input: StudentInput) => Promise<void>;
  submitLabel?: string;
  mode?: "create" | "edit";
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [structure, setStructure] = useState<SchoolStructure | null>(null);

  const form = useForm<StudentFormValues, unknown, StudentInput>({
    resolver: zodResolver(studentInputSchema),
    defaultValues: {
      country: "India",
      sameAsCurrent: true,
      admissionType: "new",
      guardians: DEFAULT_GUARDIANS,
      ...defaultValues,
    },
  });

  const {
    handleSubmit,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    schoolStructureService.get().then(setStructure).catch(() => undefined);
  }, []);

  const isEdit = mode === "edit";
  const activeStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  async function handleFormSubmit(values: StudentInput) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setServerError((error as ApiError)?.error ?? "Something went wrong. Please try again.");
    }
  }

  async function goNext() {
    const valid = await trigger(activeStep.fields as never, { shouldFocus: true });
    if (valid) setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && (
        <Alert variant="danger" title="Couldn't save student">
          {serverError}
        </Alert>
      )}

      {/* Editing walks the same five steps as adding, so the form a school
          teaches its staff once is the only form they ever see. */}
      <StepIndicator steps={STEPS} current={stepIndex} onSelect={isEdit ? setStepIndex : undefined} />

      {activeStep.id === "student" && <StudentSection form={form} />}
      {activeStep.id === "admission" && <AdmissionSection form={form} structure={structure} />}
      {activeStep.id === "parents" && <GuardiansSection form={form} />}
      {activeStep.id === "address" && <AddressSection form={form} watch={watch} />}
      {activeStep.id === "emergency" && <EmergencySection form={form} />}

      <div className="flex items-center justify-between gap-2">
        {stepIndex > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStepIndex((i) => i - 1)}>
            <ChevronLeft className="size-4" /> Back
          </Button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {!isLastStep && (
            <Button type="button" variant={isEdit ? "secondary" : "primary"} onClick={goNext}>
              Continue <ChevronRight className="size-4" />
            </Button>
          )}
          {/* An edit is usually one field on one step — don't make it a
              five-click journey to reach Save. */}
          {(isEdit || isLastStep) && (
            <Button type="submit" isLoading={isSubmitting}>
              {submitLabel}
            </Button>
          )}
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <p className="text-sm text-danger-600" role="alert">
          Some required details are missing. Check the earlier steps.
        </p>
      )}
    </form>
  );
}

/**
 * Steps are only clickable when `onSelect` is passed — editing an existing
 * student, where every step already holds saved data and jumping straight to
 * the one you came for beats clicking Continue four times. A new admission
 * still has to walk them in order so each step's validation runs.
 */
function StepIndicator({
  steps,
  current,
  onSelect,
}: {
  steps: StepDef[];
  current: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="Progress">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const content = (
          <>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                done && "border-primary-600 bg-primary-600 text-white",
                active && "border-primary-600 text-primary-700",
                !done && !active && "border-border text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn("text-sm", active ? "font-medium text-foreground" : "text-muted-foreground")}
              aria-current={active ? "step" : undefined}
            >
              {step.title}
            </span>
          </>
        );

        return (
          <li key={step.id} className="flex items-center gap-2">
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(index)}
                className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-white/5"
              >
                {content}
              </button>
            ) : (
              content
            )}
            {index < steps.length - 1 && <span className="hidden h-px w-6 bg-border sm:block" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function StudentSection({ form }: { form: Form }) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <FormField label="Admission number" required error={errors.admissionNumber?.message}>
          {(f) => <Input {...f} {...register("admissionNumber")} placeholder="ADM021" />}
        </FormField>
        <FormField label="Student ID" description="Your own enrolment number, if you use one">
          {(f) => <Input {...f} {...register("enrollmentNumber")} />}
        </FormField>
        <FormField label="First name" required error={errors.firstName?.message}>
          {(f) => <Input {...f} {...register("firstName")} placeholder="Aarav" />}
        </FormField>
        <FormField label="Middle name">{(f) => <Input {...f} {...register("middleName")} />}</FormField>
        <FormField label="Last name" required error={errors.lastName?.message}>
          {(f) => <Input {...f} {...register("lastName")} placeholder="Sharma" />}
        </FormField>
        <FormField label="Date of birth" error={errors.dateOfBirth?.message}>
          {(f) => <Input {...f} {...register("dateOfBirth")} type="date" />}
        </FormField>
        <SelectField control={control} name="gender" label="Gender" placeholder="Select gender"
          options={GENDERS.map((g) => ({ value: g, label: g[0].toUpperCase() + g.slice(1) }))} />
        <SelectField control={control} name="bloodGroup" label="Blood group" placeholder="Select blood group"
          options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))} />
        <FormField label="Nationality">{(f) => <Input {...f} {...register("nationality")} placeholder="Indian" />}</FormField>
        <FormField label="Mother tongue">{(f) => <Input {...f} {...register("motherTongue")} />}</FormField>

        <div className="sm:col-span-2">
          <Alert variant="info">
            The three fields below are optional and only needed if your school is required to report them. Leave them
            blank otherwise.
          </Alert>
        </div>
        <FormField label="Category" description="e.g. General / OBC / SC / ST">
          {(f) => <Input {...f} {...register("category")} />}
        </FormField>
        <FormField label="Religion">{(f) => <Input {...f} {...register("religion")} />}</FormField>
        <FormField
          label="Government ID reference"
          className="sm:col-span-2"
          description="Store a reference, not a full Aadhaar number, unless you must"
        >
          {(f) => <Input {...f} {...register("govtIdRef")} />}
        </FormField>
      </CardContent>
    </Card>
  );
}

function AdmissionSection({ form, structure }: { form: Form; structure: SchoolStructure | null }) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const classId = watch("classId");
  const sections = useMemo(
    () => structure?.classes.find((c) => c.id === classId)?.sections ?? [],
    [structure, classId],
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Admission</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Previous school">{(f) => <Input {...f} {...register("previousSchool")} />}</FormField>
          <FormField label="Previous class" description="The class they completed there">
            {(f) => <Input {...f} {...register("previousClass")} />}
          </FormField>
          <FormField label="Admission date" error={errors.admissionDate?.message}>
            {(f) => <Input {...f} {...register("admissionDate")} type="date" />}
          </FormField>
          <SelectField control={control} name="admissionType" label="Admission type"
            options={ADMISSION_TYPES.map((t) => ({ value: t, label: ADMISSION_TYPE_LABELS[t] }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic placement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <SelectField control={control} name="academicYearId" label="Academic year" required
            placeholder="Select academic year" error={errors.academicYearId?.message}
            options={(structure?.academicYears ?? []).map((y) => ({
              value: y.id,
              label: y.isCurrent ? `${y.label} (current)` : y.label,
            }))} />
          <SelectField control={control} name="classId" label="Class" required placeholder="Select class"
            error={errors.classId?.message}
            options={(structure?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))} />
          {/* Sections belong to a class, so they only populate once one is chosen. */}
          <SelectField control={control} name="sectionId" label="Section"
            placeholder={classId ? "Select section" : "Pick a class first"}
            options={sections.map((s) => ({ value: s.id, label: s.name }))} />
          <FormField label="Roll number">{(f) => <Input {...f} {...register("rollNumber")} />}</FormField>
          <FormField label="House">{(f) => <Input {...f} {...register("house")} />}</FormField>
          <FormField label="Stream" description={`Senior classes only — e.g. ${STREAM_SUGGESTIONS.join(", ")}`}>
            {(f) => <Input {...f} {...register("stream")} list="stream-options" />}
          </FormField>
          <datalist id="stream-options">
            {STREAM_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
          <FormField label="Medium of instruction">
            {(f) => <Input {...f} {...register("medium")} list="medium-options" />}
          </FormField>
          <datalist id="medium-options">
            {MEDIUM_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
          </datalist>
          <SelectField control={control} name="promotionStatus" label="Promotion status" placeholder="Not set"
            options={PROMOTION_STATUSES.map((p) => ({ value: p, label: PROMOTION_STATUS_LABELS[p] }))} />
          <SelectField control={control} name="status" label="Student status" placeholder="Active"
            options={STUDENT_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
        </CardContent>
      </Card>
    </>
  );
}

function GuardiansSection({ form }: { form: Form }) {
  const { control, register } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "guardians" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parents &amp; guardians</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Leave a block blank if it doesn&apos;t apply — a card with no name is simply ignored.
        </p>

        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <Controller
                control={control}
                name={`guardians.${index}.relationship`}
                render={({ field: sel }) => (
                  <Select value={sel.value ?? "guardian"} onValueChange={sel.onChange}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["father", "mother", "guardian", "grandparent", "other"].map((r) => (
                        <SelectItem key={r} value={r}>
                          {r[0].toUpperCase() + r.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {fields.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Full name">
                {(f) => <Input {...f} {...register(`guardians.${index}.fullName`)} />}
              </FormField>
              <FormField label="Mobile">
                {(f) => <Input {...f} {...register(`guardians.${index}.mobile`)} />}
              </FormField>
              <FormField label="Email">
                {(f) => <Input {...f} type="email" {...register(`guardians.${index}.email`)} />}
              </FormField>
              <FormField label="Occupation">
                {(f) => <Input {...f} {...register(`guardians.${index}.occupation`)} />}
              </FormField>
              <FormField label="Employer">
                {(f) => <Input {...f} {...register(`guardians.${index}.organization`)} />}
              </FormField>
              <FormField label="Qualification">
                {(f) => <Input {...f} {...register(`guardians.${index}.education`)} />}
              </FormField>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <CheckboxField control={control} name={`guardians.${index}.isPrimary`} label="Main contact" />
              <CheckboxField control={control} name={`guardians.${index}.isEmergencyContact`} label="Emergency contact" />
              <CheckboxField control={control} name={`guardians.${index}.isAuthorizedPickup`} label="Can collect the child" />
              <CheckboxField control={control} name={`guardians.${index}.canReceiveFee`} label="Receives fee notices" />
            </div>
          </div>
        ))}

        {fields.length < 4 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => append({ relationship: "guardian", fullName: "", isAuthorizedPickup: true })}
          >
            <Plus className="size-4" /> Add another guardian
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AddressSection({ form, watch }: { form: Form; watch: Form["watch"] }) {
  const { register, control } = form;
  const sameAsCurrent = watch("sameAsCurrent");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Address line 1" className="sm:col-span-2">
            {(f) => <Textarea {...f} rows={2} {...register("address")} />}
          </FormField>
          <FormField label="Address line 2" className="sm:col-span-2">
            {(f) => <Input {...f} {...register("addressLine2")} />}
          </FormField>
          <FormField label="City">{(f) => <Input {...f} {...register("city")} />}</FormField>
          <FormField label="District">{(f) => <Input {...f} {...register("district")} />}</FormField>
          <FormField label="State">{(f) => <Input {...f} {...register("state")} />}</FormField>
          <FormField label="Country">{(f) => <Input {...f} {...register("country")} />}</FormField>
          <FormField label="PIN code">{(f) => <Input {...f} {...register("pinCode")} />}</FormField>

          <div className="sm:col-span-2">
            <CheckboxField control={control} name="sameAsCurrent" label="Permanent address is the same as above" />
          </div>

          {!sameAsCurrent && (
            <>
              <FormField label="Permanent address" className="sm:col-span-2">
                {(f) => <Textarea {...f} rows={2} {...register("permanentAddress")} />}
              </FormField>
              <FormField label="City">{(f) => <Input {...f} {...register("permanentCity")} />}</FormField>
              <FormField label="District">{(f) => <Input {...f} {...register("permanentDistrict")} />}</FormField>
              <FormField label="State">{(f) => <Input {...f} {...register("permanentState")} />}</FormField>
              <FormField label="PIN code">{(f) => <Input {...f} {...register("permanentPinCode")} />}</FormField>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Primary mobile">{(f) => <Input {...f} {...register("primaryMobile")} />}</FormField>
          <FormField label="Alternate mobile">{(f) => <Input {...f} {...register("secondaryMobile")} />}</FormField>
          <FormField label="WhatsApp number">{(f) => <Input {...f} {...register("whatsappNumber")} />}</FormField>
          <FormField label="Parent email">{(f) => <Input {...f} type="email" {...register("parentEmail")} />}</FormField>
          <FormField label="Student email" className="sm:col-span-2">
            {(f) => <Input {...f} type="email" {...register("studentEmail")} />}
          </FormField>
        </CardContent>
      </Card>
    </>
  );
}

function EmergencySection({ form }: { form: Form }) {
  const { register } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emergency contact</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name">{(f) => <Input {...f} {...register("emergencyName")} />}</FormField>
        <FormField label="Relationship">
          {(f) => <Input {...f} {...register("emergencyRelation")} placeholder="Uncle" />}
        </FormField>
        <FormField label="Mobile">{(f) => <Input {...f} {...register("emergencyContact")} />}</FormField>
        <FormField label="Alternate number">{(f) => <Input {...f} {...register("emergencyAltPhone")} />}</FormField>
        <FormField label="Address" className="sm:col-span-2">
          {(f) => <Textarea {...f} rows={2} {...register("emergencyAddress")} />}
        </FormField>
      </CardContent>
    </Card>
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
}: {
  control: Form["control"];
  name: keyof StudentFormValues;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <FormField label={label} required={required} error={error}>
      {(f) => (
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <Select
              value={(field.value as string) ?? ""}
              onValueChange={field.onChange}
              disabled={options.length === 0}
            >
              <SelectTrigger id={f.id}>
                <SelectValue placeholder={options.length === 0 ? "None available" : placeholder} />
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

function CheckboxField({
  control,
  name,
  label,
}: {
  control: Form["control"];
  // Guardian flags are indexed paths, so this is deliberately wider than a plain key.
  name: string;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name as never}
      render={({ field }) => (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(Boolean(v))} />
          {label}
        </label>
      )}
    />
  );
}
