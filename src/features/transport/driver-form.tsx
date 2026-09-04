"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Search, X, UserCog } from "lucide-react";
import { transportDriverInputSchema, type TransportDriverInput } from "@/lib/validation/transport-driver";
import { DRIVER_STATUSES, DRIVER_STATUS_LABELS } from "@/lib/constants/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import type { ApiError } from "@/services/studentService";

type DriverFormValues = z.input<typeof transportDriverInputSchema>;

interface StaffResult {
  id: string;
  fullName: string;
  mobileNumber: string;
  employeeId?: string;
}

interface DriverFormProps {
  defaultValues?: Partial<TransportDriverInput>;
  defaultStaff?: { id: string; fullName: string; mobileNumber: string } | null;
  onSubmit: (input: TransportDriverInput) => Promise<void>;
  submitLabel?: string;
}

export function DriverForm({ defaultValues, defaultStaff, onSubmit, submitLabel = "Add driver" }: DriverFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState(defaultStaff ?? null);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffResults, setStaffResults] = useState<StaffResult[]>([]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DriverFormValues, unknown, TransportDriverInput>({
    resolver: zodResolver(transportDriverInputSchema),
    defaultValues: { status: "active", ...defaultValues },
  });

  const staffId = watch("staffId");
  const isVendor = !staffId;

  useEffect(() => {
    if (!staffSearch.trim()) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      fetch(`/api/staff?q=${encodeURIComponent(staffSearch)}&pageSize=8`)
        .then((r) => r.json())
        .then((body) => {
          if (!cancelled) setStaffResults(body.data ?? []);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [staffSearch]);

  function handleStaffSearchChange(value: string) {
    setStaffSearch(value);
    if (!value.trim()) setStaffResults([]);
  }

  function selectStaff(staff: StaffResult) {
    setSelectedStaff(staff);
    setValue("staffId", staff.id, { shouldValidate: true });
    setStaffSearch("");
    setStaffResults([]);
  }

  function clearStaff() {
    setSelectedStaff(null);
    setValue("staffId", undefined, { shouldValidate: true });
  }

  async function handleFormSubmit(values: TransportDriverInput) {
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
      {serverError && (
        <Alert variant="danger" title="Couldn't save driver">
          {serverError}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>A school-employed driver links to their staff record; a vendor driver is entered directly.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {selectedStaff ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar initials={selectedStaff.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")} size="sm" />
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedStaff.fullName}</p>
                  <p className="text-xs text-muted-foreground">{selectedStaff.mobileNumber}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={clearStaff}>
                <X className="size-4" /> Change
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>Link to a staff member (optional)</Label>
              <Input leadingIcon={<Search />} placeholder="Search staff by name..." value={staffSearch} onChange={(e) => handleStaffSearchChange(e.target.value)} />
              {staffResults.length > 0 && (
                <div className="flex flex-col gap-1 rounded-md border border-border p-1">
                  {staffResults.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => selectStaff(s)}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <UserCog className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{s.fullName}</span>
                      <span className="text-xs text-muted-foreground">{s.mobileNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isVendor && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" required={isVendor} error={errors.fullName?.message}>
                {(field) => <Input {...field} {...register("fullName")} />}
              </FormField>
              <FormField label="Phone" required={isVendor} error={errors.phone?.message}>
                {(field) => <Input {...field} {...register("phone")} />}
              </FormField>
              <FormField label="Address" className="sm:col-span-2" error={errors.address?.message}>
                {(field) => <Input {...field} {...register("address")} />}
              </FormField>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>License &amp; verification</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="License number" error={errors.licenseNumber?.message}>
            {(field) => <Input {...field} {...register("licenseNumber")} />}
          </FormField>
          <FormField label="License type" error={errors.licenseType?.message}>
            {(field) => <Input {...field} {...register("licenseType")} placeholder="e.g. LMV, HMV" />}
          </FormField>
          <FormField label="License issue date" error={errors.licenseIssueDate?.message}>
            {(field) => <Input {...field} {...register("licenseIssueDate")} type="date" />}
          </FormField>
          <FormField label="License expiry date" error={errors.licenseExpiryDate?.message}>
            {(field) => <Input {...field} {...register("licenseExpiryDate")} type="date" />}
          </FormField>
          <FormField label="Police verification date" error={errors.policeVerificationDate?.message}>
            {(field) => <Input {...field} {...register("policeVerificationDate")} type="date" />}
          </FormField>
          <FormField label="Medical certificate expiry" error={errors.medicalCertificateExpiryDate?.message}>
            {(field) => <Input {...field} {...register("medicalCertificateExpiryDate")} type="date" />}
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
                      {DRIVER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {DRIVER_STATUS_LABELS[s]}
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

      <div className="flex justify-end gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
