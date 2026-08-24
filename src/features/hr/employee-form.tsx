"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { staffInputSchema, type StaffInput } from "@/lib/validation/staff";
import { BLOOD_GROUPS, GENDERS, STAFF_CATEGORIES, STAFF_CATEGORY_LABELS } from "@/lib/constants/people";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_STATUS_LABELS, MARITAL_STATUSES } from "@/lib/constants/hr";
import { hrLookupService } from "@/services/hrService";
import type { HrLookups } from "@/types/hr";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";

/** Pre-validation shape — what the inputs hold before zod defaults/coercion apply. */
type EmployeeFormValues = z.input<typeof staffInputSchema>;

type Form = UseFormReturn<EmployeeFormValues, unknown, StaffInput>;

interface StepDef {
  id: string;
  title: string;
  /** Fields validated before the wizard will advance past this step. */
  fields: (keyof EmployeeFormValues)[];
}

/**
 * Steps 4/5 (education, experience) and 7 (documents) are intentionally absent
 * from the create wizard: they are repeating collections that belong to an
 * existing employee, so they're managed from the profile tabs once the record
 * has an id. Creating an employee first, then filing their records, avoids
 * holding uploads in limbo against a record that may never be saved.
 */
const STEPS: StepDef[] = [
  { id: "personal", title: "Personal", fields: ["firstName", "middleName", "lastName", "preferredName", "dateOfBirth", "gender", "bloodGroup", "maritalStatus"] },
  { id: "contact", title: "Contact", fields: ["mobileNumber", "alternateNumber", "email", "officialEmail", "address", "permanentAddress", "city", "state", "country", "pinCode", "emergencyName", "emergencyRelation", "emergencyContact"] },
  { id: "employment", title: "Employment", fields: ["employeeId", "category", "designationId", "departmentId", "campusId", "employeeTypeId", "reportingManagerId", "workLocation", "joiningDate", "confirmationDate", "probationMonths", "employmentStatus"] },
  { id: "payroll", title: "Bank & Payroll", fields: ["panNumber", "bankName", "bankAccountNumber", "bankIfsc", "bankAccountHolder", "pfNumber", "esicNumber"] },
];

interface EmployeeFormProps {
  defaultValues?: Partial<StaffInput>;
  onSubmit: (input: StaffInput) => Promise<void>;
  submitLabel?: string;
  /** Edit mode renders every section at once — stepping through is for creation. */
  mode?: "create" | "edit";
  /** Excluded from the reporting-manager list so an employee can't report to themselves. */
  currentEmployeeId?: string;
}

export function EmployeeForm({
  defaultValues,
  onSubmit,
  submitLabel = "Create employee",
  mode = "create",
  currentEmployeeId,
}: EmployeeFormProps) {
  const can = useCan();
  const canEditPay = can("employeeSalary", "edit");

  const [serverError, setServerError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [lookups, setLookups] = useState<HrLookups | null>(null);
  const [lookupError, setLookupError] = useState(false);

  // Payroll step is hidden entirely when the user may not write pay data —
  // the server rejects those fields too, so hiding never becomes the only guard.
  const steps = useMemo(() => STEPS.filter((s) => s.id !== "payroll" || canEditPay), [canEditPay]);

  const form = useForm<EmployeeFormValues, unknown, StaffInput>({
    resolver: zodResolver(staffInputSchema),
    defaultValues: { employmentStatus: "active", category: "teacher", country: "India", ...defaultValues },
  });

  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    hrLookupService
      .all()
      .then(setLookups)
      .catch(() => setLookupError(true));
  }, []);

  async function handleFormSubmit(values: StaffInput) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const apiError = error as ApiError;
      setServerError(apiError?.error ?? "Something went wrong. Please try again.");
    }
  }

  async function goNext() {
    const valid = await trigger(steps[stepIndex].fields as never, { shouldFocus: true });
    if (valid) setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  const isEdit = mode === "edit";
  const activeStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && (
        <Alert variant="danger" title="Couldn't save employee">
          {serverError}
        </Alert>
      )}
      {lookupError && (
        <Alert variant="warning" title="Couldn't load departments and designations">
          You can still save the employee — assign these from the profile afterwards.
        </Alert>
      )}

      {!isEdit && <StepIndicator steps={steps} current={stepIndex} />}

      {(isEdit || activeStep.id === "personal") && <PersonalSection form={form} />}
      {(isEdit || activeStep.id === "contact") && <ContactSection form={form} />}
      {(isEdit || activeStep.id === "employment") && (
        <EmploymentSection form={form} lookups={lookups} currentEmployeeId={currentEmployeeId} isEdit={isEdit} />
      )}
      {canEditPay && (isEdit || activeStep.id === "payroll") && <PayrollSection form={form} />}

      <div className="flex items-center justify-between gap-2">
        {!isEdit && stepIndex > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStepIndex((i) => i - 1)}>
            <ChevronLeft className="size-4" /> Back
          </Button>
        ) : (
          <span />
        )}

        {isEdit || isLastStep ? (
          <Button type="submit" isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            Continue <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      {/* Surfaces errors from a step the user has already navigated past. */}
      {!isEdit && Object.keys(errors).length > 0 && (
        <p className="text-sm text-danger-600" role="alert">
          Some required details are missing. Check the earlier steps.
        </p>
      )}
    </form>
  );
}

function StepIndicator({ steps, current }: { steps: StepDef[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="Progress">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.id} className="flex items-center gap-2">
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
            {index < steps.length - 1 && <span className="hidden h-px w-6 bg-border sm:block" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function PersonalSection({ form }: { form: Form }) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" required error={errors.firstName?.message}>
          {(field) => <Input {...field} {...register("firstName")} placeholder="Priya" />}
        </FormField>
        <FormField label="Middle name" error={errors.middleName?.message}>
          {(field) => <Input {...field} {...register("middleName")} />}
        </FormField>
        <FormField label="Last name" error={errors.lastName?.message}>
          {(field) => <Input {...field} {...register("lastName")} placeholder="Nair" />}
        </FormField>
        <FormField label="Preferred name" error={errors.preferredName?.message}>
          {(field) => <Input {...field} {...register("preferredName")} />}
        </FormField>
        <FormField label="Date of birth" error={errors.dateOfBirth?.message}>
          {(field) => <Input {...field} {...register("dateOfBirth")} type="date" />}
        </FormField>
        <SelectField
          control={control}
          name="gender"
          label="Gender"
          placeholder="Select gender"
          error={errors.gender?.message}
          options={GENDERS.map((g) => ({ value: g, label: g[0].toUpperCase() + g.slice(1) }))}
        />
        <SelectField
          control={control}
          name="bloodGroup"
          label="Blood group"
          placeholder="Select blood group"
          error={errors.bloodGroup?.message}
          options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
        />
        <SelectField
          control={control}
          name="maritalStatus"
          label="Marital status"
          placeholder="Select status"
          error={errors.maritalStatus?.message}
          options={MARITAL_STATUSES.map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))}
        />
      </CardContent>
    </Card>
  );
}

function ContactSection({ form }: { form: Form }) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Mobile number" required error={errors.mobileNumber?.message}>
            {(field) => <Input {...field} {...register("mobileNumber")} placeholder="+91 90XXXXXXXX" />}
          </FormField>
          <FormField label="Alternate number" error={errors.alternateNumber?.message}>
            {(field) => <Input {...field} {...register("alternateNumber")} />}
          </FormField>
          <FormField label="Personal email" error={errors.email?.message}>
            {(field) => <Input {...field} {...register("email")} type="email" />}
          </FormField>
          <FormField label="Official email" error={errors.officialEmail?.message}>
            {(field) => <Input {...field} {...register("officialEmail")} type="email" />}
          </FormField>
          <FormField label="Current address" className="sm:col-span-2" error={errors.address?.message}>
            {(field) => <Textarea {...field} {...register("address")} rows={2} />}
          </FormField>
          <FormField label="Permanent address" className="sm:col-span-2" error={errors.permanentAddress?.message}>
            {(field) => <Textarea {...field} {...register("permanentAddress")} rows={2} />}
          </FormField>
          <FormField label="City" error={errors.city?.message}>
            {(field) => <Input {...field} {...register("city")} />}
          </FormField>
          <FormField label="State" error={errors.state?.message}>
            {(field) => <Input {...field} {...register("state")} />}
          </FormField>
          <FormField label="Country" error={errors.country?.message}>
            {(field) => <Input {...field} {...register("country")} />}
          </FormField>
          <FormField label="PIN code" error={errors.pinCode?.message}>
            {(field) => <Input {...field} {...register("pinCode")} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Contact name" error={errors.emergencyName?.message}>
            {(field) => <Input {...field} {...register("emergencyName")} />}
          </FormField>
          <FormField label="Relationship" error={errors.emergencyRelation?.message}>
            {(field) => <Input {...field} {...register("emergencyRelation")} placeholder="Spouse" />}
          </FormField>
          <FormField label="Phone" error={errors.emergencyContact?.message}>
            {(field) => <Input {...field} {...register("emergencyContact")} />}
          </FormField>
          <FormField label="Address" error={errors.emergencyAddress?.message}>
            {(field) => <Input {...field} {...register("emergencyAddress")} />}
          </FormField>
        </CardContent>
      </Card>
    </>
  );
}

function EmploymentSection({
  form,
  lookups,
  currentEmployeeId,
  isEdit,
}: {
  form: Form;
  lookups: HrLookups | null;
  currentEmployeeId?: string;
  isEdit: boolean;
}) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const managers = (lookups?.managers ?? []).filter((m) => m.id !== currentEmployeeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employment</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Employee ID"
          error={errors.employeeId?.message}
          description={isEdit ? undefined : "Leave blank to generate the next ID automatically"}
        >
          {(field) => <Input {...field} {...register("employeeId")} placeholder="EMP-000001" />}
        </FormField>
        <SelectField
          control={control}
          name="category"
          label="Category"
          required
          error={errors.category?.message}
          options={STAFF_CATEGORIES.map((c) => ({ value: c, label: STAFF_CATEGORY_LABELS[c] }))}
        />
        <SelectField
          control={control}
          name="designationId"
          label="Designation"
          placeholder="Select designation"
          error={errors.designationId?.message}
          options={(lookups?.designations ?? []).map((d) => ({ value: d.id, label: d.name }))}
        />
        <SelectField
          control={control}
          name="departmentId"
          label="Department"
          placeholder="Select department"
          error={errors.departmentId?.message}
          options={(lookups?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
        />
        <SelectField
          control={control}
          name="employeeTypeId"
          label="Employee type"
          placeholder="Select type"
          error={errors.employeeTypeId?.message}
          options={(lookups?.employeeTypes ?? []).map((t) => ({ value: t.id, label: t.name }))}
        />
        <SelectField
          control={control}
          name="campusId"
          label="Campus"
          placeholder="Select campus"
          error={errors.campusId?.message}
          options={(lookups?.campuses ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <SelectField
          control={control}
          name="reportingManagerId"
          label="Reporting manager"
          placeholder="Select manager"
          error={errors.reportingManagerId?.message}
          options={managers.map((m) => ({ value: m.id, label: `${m.fullName} (${m.employeeId})` }))}
        />
        <FormField label="Work location" error={errors.workLocation?.message}>
          {(field) => <Input {...field} {...register("workLocation")} />}
        </FormField>
        <FormField label="Joining date" error={errors.joiningDate?.message}>
          {(field) => <Input {...field} {...register("joiningDate")} type="date" />}
        </FormField>
        <FormField label="Confirmation date" error={errors.confirmationDate?.message}>
          {(field) => <Input {...field} {...register("confirmationDate")} type="date" />}
        </FormField>
        <FormField label="Probation (months)" error={errors.probationMonths?.message}>
          {(field) => <Input {...field} {...register("probationMonths")} type="number" min={0} max={60} />}
        </FormField>
        <SelectField
          control={control}
          name="employmentStatus"
          label="Employment status"
          error={errors.employmentStatus?.message}
          options={EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: EMPLOYMENT_STATUS_LABELS[s] }))}
        />
      </CardContent>
    </Card>
  );
}

function PayrollSection({ form }: { form: Form }) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank &amp; payroll</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Alert variant="info" className="sm:col-span-2">
          These details are restricted. Only roles with salary access can view or change them.
        </Alert>
        <FormField label="PAN" error={errors.panNumber?.message}>
          {(field) => <Input {...field} {...register("panNumber")} />}
        </FormField>
        <FormField label="Bank name" error={errors.bankName?.message}>
          {(field) => <Input {...field} {...register("bankName")} />}
        </FormField>
        <FormField label="Account holder" error={errors.bankAccountHolder?.message}>
          {(field) => <Input {...field} {...register("bankAccountHolder")} />}
        </FormField>
        <FormField label="Account number" error={errors.bankAccountNumber?.message}>
          {(field) => <Input {...field} {...register("bankAccountNumber")} />}
        </FormField>
        <FormField label="IFSC" error={errors.bankIfsc?.message}>
          {(field) => <Input {...field} {...register("bankIfsc")} />}
        </FormField>
        <FormField label="PF number" error={errors.pfNumber?.message}>
          {(field) => <Input {...field} {...register("pfNumber")} />}
        </FormField>
        <FormField label="ESIC number" error={errors.esicNumber?.message}>
          {(field) => <Input {...field} {...register("esicNumber")} />}
        </FormField>
      </CardContent>
    </Card>
  );
}

/** Wraps Controller + Select, which every dropdown in this form needs identically. */
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
  name: keyof EmployeeFormValues;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <FormField label={label} required={required} error={error}>
      {(field) => (
        <Controller
          name={name}
          control={control}
          render={({ field: selectField }) => (
            <Select
              value={(selectField.value as string) ?? ""}
              onValueChange={selectField.onChange}
              disabled={options.length === 0}
            >
              <SelectTrigger id={field.id}>
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
