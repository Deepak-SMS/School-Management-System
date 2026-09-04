"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

interface SuperAdminLoginFormValues {
  email: string;
  password: string;
}

export function SuperAdminLoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SuperAdminLoginFormValues>({ defaultValues: { email: "", password: "" } });

  async function onSubmit(values: SuperAdminLoginFormValues) {
    setServerError(null);
    const response = await fetch("/api/auth/super-admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setServerError(data?.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/super-admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && (
        <Alert variant="danger" role="alert">
          {serverError}
        </Alert>
      )}
      <FormField label="Email" required error={errors.email?.message}>
        {(field) => (
          <Input
            {...field}
            {...register("email", { required: "Email is required" })}
            type="email"
            autoComplete="email"
            placeholder="you@platform.example"
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

      <Button type="submit" size="lg" isLoading={isSubmitting} className="mt-2">
        Sign in
      </Button>
    </form>
  );
}
