"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Check, ChevronLeft, ChevronRight, Copy, CheckCircle2 } from "lucide-react";
import { createSchoolSchema, type CreateSchoolInput } from "@/lib/validation/platform-school";
import { SCHOOL_PLANS, SCHOOL_PLAN_LABELS } from "@/lib/constants/platform";
import { platformService } from "@/services/platformService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/studentService";
import type { CreateSchoolResult } from "@/types/platform";

type CreateSchoolFormValues = z.input<typeof createSchoolSchema>;
type Form = UseFormReturn<CreateSchoolFormValues, unknown, CreateSchoolInput>;

interface StepDef {
  id: string;
  title: string;
  fields: (keyof CreateSchoolFormValues)[];
}

const STEPS: StepDef[] = [
  { id: "school", title: "School Info", fields: ["name", "shortName", "email", "phone", "address", "city", "state", "country", "pinCode"] },
  { id: "admin", title: "School Admin", fields: ["adminName", "adminEmail"] },
  { id: "plan", title: "Plan", fields: ["plan"] },
];

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

function SchoolInfoSection({ form }: { form: Form }) {
  const { register, formState: { errors } } = form;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="School name" required error={errors.name?.message} className="sm:col-span-2">
        {(f) => <Input {...f} {...register("name")} invalid={f.invalid} placeholder="Greenfield Public School" />}
      </FormField>
      <FormField label="Short name" required error={errors.shortName?.message}>
        {(f) => <Input {...f} {...register("shortName")} invalid={f.invalid} placeholder="Greenfield" />}
      </FormField>
      <FormField label="School email" error={errors.email?.message}>
        {(f) => <Input {...f} {...register("email")} type="email" invalid={f.invalid} placeholder="office@school.example" />}
      </FormField>
      <FormField label="Phone" error={errors.phone?.message}>
        {(f) => <Input {...f} {...register("phone")} invalid={f.invalid} />}
      </FormField>
      <FormField label="City" error={errors.city?.message}>
        {(f) => <Input {...f} {...register("city")} invalid={f.invalid} />}
      </FormField>
      <FormField label="Address" error={errors.address?.message} className="sm:col-span-2">
        {(f) => <Input {...f} {...register("address")} invalid={f.invalid} />}
      </FormField>
      <FormField label="State" error={errors.state?.message}>
        {(f) => <Input {...f} {...register("state")} invalid={f.invalid} />}
      </FormField>
      <FormField label="Country" error={errors.country?.message}>
        {(f) => <Input {...f} {...register("country")} invalid={f.invalid} />}
      </FormField>
      <FormField label="Pin code" error={errors.pinCode?.message}>
        {(f) => <Input {...f} {...register("pinCode")} invalid={f.invalid} />}
      </FormField>
    </div>
  );
}

function SchoolAdminSection({ form }: { form: Form }) {
  const { register, formState: { errors } } = form;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <p className="text-sm text-muted-foreground sm:col-span-2">
        This becomes the school&apos;s first login — a Login ID and temporary password are generated once the school is created.
      </p>
      <FormField label="Admin name" required error={errors.adminName?.message}>
        {(f) => <Input {...f} {...register("adminName")} invalid={f.invalid} placeholder="Rajesh Kumar" />}
      </FormField>
      <FormField label="Admin email" required error={errors.adminEmail?.message}>
        {(f) => <Input {...f} {...register("adminEmail")} type="email" invalid={f.invalid} placeholder="admin@school.example" />}
      </FormField>
    </div>
  );
}

function PlanSection({ form }: { form: Form }) {
  const { control } = form;
  return (
    <Controller
      name="plan"
      control={control}
      render={({ field }) => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SCHOOL_PLANS.map((plan) => (
            <button
              key={plan}
              type="button"
              onClick={() => field.onChange(plan)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                field.value === plan ? "border-primary-600 bg-primary-50 dark:bg-primary-500/10" : "border-border hover:bg-black/[.02] dark:hover:bg-white/[.03]",
              )}
            >
              <p className="text-sm font-semibold text-foreground">{SCHOOL_PLAN_LABELS[plan]}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {plan === "starter" && "Core school records, students, and fees."}
                {plan === "professional" && "Adds HR, ID cards, certificates, and admissions."}
                {plan === "enterprise" && "Every module, unrestricted."}
              </p>
            </button>
          ))}
        </div>
      )}
    />
  );
}

function CredentialsResult({ result }: { result: CreateSchoolResult }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  async function copyCredentials() {
    const text = `School: ${result.school.name}\nLogin ID: ${result.admin.email}\nTemporary password: ${result.admin.temporaryPassword}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2 text-accent-700">
        <CheckCircle2 className="size-5" />
        <p className="text-sm font-semibold">School created</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Share these credentials with {result.admin.name} — this password is shown once and cannot be retrieved again.
      </p>
      <dl className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Login ID</dt>
          <dd className="mt-0.5 font-mono text-sm text-foreground">{result.admin.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Temporary password</dt>
          <dd className="mt-0.5 font-mono text-sm text-foreground">{result.admin.temporaryPassword}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={copyCredentials}>
          <Copy className="size-4" /> {copied ? "Copied" : "Copy credentials"}
        </Button>
        <Button type="button" onClick={() => router.push(`/super-admin/schools/${result.school.id}`)}>
          View school
        </Button>
      </div>
    </Card>
  );
}

export function CreateSchoolWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateSchoolResult | null>(null);

  const form = useForm<CreateSchoolFormValues, unknown, CreateSchoolInput>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: { plan: "starter" },
  });

  const { handleSubmit, trigger, formState: { isSubmitting } } = form;
  const activeStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  async function goNext() {
    const valid = await trigger(activeStep.fields, { shouldFocus: true });
    if (valid) setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  async function onSubmit(values: CreateSchoolInput) {
    setServerError(null);
    try {
      const created = await platformService.createSchool(values);
      setResult(created);
    } catch (error) {
      setServerError((error as ApiError)?.error ?? "Something went wrong. Please try again.");
    }
  }

  if (result) return <CredentialsResult result={result} />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {serverError && (
        <Alert variant="danger" title="Couldn't create school">
          {serverError}
        </Alert>
      )}

      <StepIndicator steps={STEPS} current={stepIndex} />

      {activeStep.id === "school" && <SchoolInfoSection form={form} />}
      {activeStep.id === "admin" && <SchoolAdminSection form={form} />}
      {activeStep.id === "plan" && <PlanSection form={form} />}

      <div className="flex items-center justify-between gap-2">
        {stepIndex > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStepIndex((i) => i - 1)}>
            <ChevronLeft className="size-4" /> Back
          </Button>
        ) : (
          <span />
        )}

        {!isLastStep ? (
          <Button type="button" onClick={goNext}>
            Continue <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button type="submit" isLoading={isSubmitting}>
            Create school
          </Button>
        )}
      </div>
    </form>
  );
}
