"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Mail, Lock, ShieldCheck, BookOpen, GraduationCap, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { LOGIN_ROLE_GROUP_LABELS, type LoginRoleGroup } from "@/types/user";

interface LoginFormValues {
  email: string;
  password: string;
}

const ROLE_TILES: { value: LoginRoleGroup; icon: typeof ShieldCheck }[] = [
  { value: "admin", icon: ShieldCheck },
  { value: "teacher", icon: BookOpen },
  { value: "student", icon: GraduationCap },
  { value: "parent", icon: Heart },
];

/** `schoolSlug` scopes sign-in to one school's branded /{slug}/admin link — see src/app/[schoolSlug]/admin. */
export function LoginForm({ schoolSlug }: { schoolSlug?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loginAs, setLoginAs] = useState<LoginRoleGroup>("admin");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ defaultValues: { email: "", password: "" } });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, loginAs, ...(schoolSlug ? { schoolSlug } : {}) }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setServerError(data?.error ?? "Something went wrong. Please try again.");
      return;
    }

    // The server resolves which school this login belongs to even when we
    // didn't send a schoolSlug (a plain /login sign-in) — always land on that
    // school's own /{slug}/admin, never the generic /admin. A parent/student
    // role always lands in the portal instead, regardless of school slug.
    const resolvedSlug: string | null = data?.schoolSlug ?? schoolSlug ?? null;
    const isPortal = data?.role === "parent" || data?.role === "student";
    const destination =
      searchParams.get("from") || (isPortal ? "/portal" : resolvedSlug ? `/${resolvedSlug}/admin` : "/admin");
    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError && (
        <Alert variant="danger" role="alert">
          {serverError}
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Select role</span>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Sign in as">
          {ROLE_TILES.map(({ value, icon: Icon }) => {
            const selected = loginAs === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setLoginAs(value)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3.5 py-3 text-left transition-all duration-200 ease-out",
                  selected
                    ? "border-primary-500 bg-primary-50 shadow-sm ring-1 ring-primary-500/30 dark:bg-primary-500/10"
                    : "border-border-strong bg-surface hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-500/5",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
                    selected ? "bg-primary-600 text-white" : "bg-primary-100 text-primary-600 dark:bg-primary-500/15",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className={cn("text-sm font-medium transition-colors duration-200", selected ? "text-primary-700 dark:text-primary-300" : "text-foreground")}>
                  {LOGIN_ROLE_GROUP_LABELS[value]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <FormField label="Email" required error={errors.email?.message}>
        {(field) => (
          <Input
            {...field}
            {...register("email", { required: "Email is required" })}
            type="email"
            autoComplete="email"
            placeholder="you@school.example"
            leadingIcon={<Mail />}
            invalid={field.invalid}
          />
        )}
      </FormField>

      <FormField label="Password" required error={errors.password?.message}>
        {(field) => (
          <PasswordInput
            {...field}
            {...register("password", { required: "Password is required" })}
            autoComplete="current-password"
            placeholder="••••••••"
            leadingIcon={<Lock />}
            invalid={field.invalid}
          />
        )}
      </FormField>

      <Button type="submit" size="lg" isLoading={isSubmitting} className="mt-1">
        Sign In as {LOGIN_ROLE_GROUP_LABELS[loginAs]}
      </Button>
    </form>
  );
}
