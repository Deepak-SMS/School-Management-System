"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  SCHOOL_TYPES,
  SCHOOL_TYPE_LABELS,
  INSTITUTION_TYPES,
  INSTITUTION_TYPE_LABELS,
  WEEKDAYS,
  WEEKDAY_LABELS,
  TIME_ZONES,
  CURRENCIES,
  DATE_FORMATS,
  LANGUAGES,
} from "@/lib/constants/school";
import type { SchoolProfileInput, SchoolProfileRecord } from "@/types/schoolProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

interface SchoolProfileFormProps {
  profile: SchoolProfileRecord;
  onSubmit: (input: SchoolProfileInput) => Promise<void>;
  onCancel: () => void;
}

export function SchoolProfileForm({ profile, onSubmit, onCancel }: SchoolProfileFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const initialWorkingDays: string[] = profile.workingDaysJson ? JSON.parse(profile.workingDaysJson) : ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const [workingDays, setWorkingDays] = useState<string[]>(initialWorkingDays);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SchoolProfileInput>({
    defaultValues: {
      name: profile.name,
      shortName: profile.shortName,
      registrationNumber: profile.registrationNumber ?? undefined,
      affiliationBoard: profile.affiliationBoard ?? undefined,
      udisePlusCode: profile.udisePlusCode ?? undefined,
      udiseSchoolId: profile.udiseSchoolId ?? undefined,
      boardAffiliationNumber: profile.boardAffiliationNumber ?? undefined,
      recognitionNumber: profile.recognitionNumber ?? undefined,
      rteRegistrationNumber: profile.rteRegistrationNumber ?? undefined,
      nocNumber: profile.nocNumber ?? undefined,
      schoolType: profile.schoolType as SchoolProfileInput["schoolType"],
      institutionType: profile.institutionType as SchoolProfileInput["institutionType"],
      establishedYear: profile.establishedYear ?? undefined,
      schoolCode: profile.schoolCode ?? undefined,
      email: profile.email ?? undefined,
      phone: profile.phone ?? undefined,
      alternatePhone: profile.alternatePhone ?? undefined,
      website: profile.website ?? undefined,
      address: profile.address ?? undefined,
      city: profile.city ?? undefined,
      state: profile.state ?? undefined,
      country: profile.country ?? undefined,
      pinCode: profile.pinCode ?? undefined,
      principalName: profile.principalName ?? undefined,
      administratorName: profile.administratorName ?? undefined,
      administrativeEmail: profile.administrativeEmail ?? undefined,
      administrativePhone: profile.administrativePhone ?? undefined,
      timeZone: profile.timeZone as SchoolProfileInput["timeZone"],
      currency: profile.currency as SchoolProfileInput["currency"],
      dateFormat: profile.dateFormat as SchoolProfileInput["dateFormat"],
      language: profile.language as SchoolProfileInput["language"],
      weekStartDay: profile.weekStartDay as SchoolProfileInput["weekStartDay"],
      facebookUrl: profile.facebookUrl ?? undefined,
      instagramUrl: profile.instagramUrl ?? undefined,
      youtubeUrl: profile.youtubeUrl ?? undefined,
      linkedinUrl: profile.linkedinUrl ?? undefined,
      twitterUrl: profile.twitterUrl ?? undefined,
    },
  });

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function handleCancel() {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    onCancel();
  }

  async function handleFormSubmit(values: SchoolProfileInput) {
    setServerError(null);
    try {
      await onSubmit({ ...values, workingDaysJson: JSON.stringify(workingDays) });
    } catch (error) {
      const apiError = error as ApiError;
      setServerError(apiError?.error ?? "Something went wrong. Please try again.");
    }
  }

  function toggleWorkingDay(day: string) {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {serverError && <Alert variant="danger" title="Couldn't save school profile">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="School name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register("name", { required: "School name is required" })} />}
          </FormField>
          <FormField label="School code" error={errors.schoolCode?.message}>
            {(field) => <Input {...field} {...register("schoolCode")} />}
          </FormField>
          <FormField label="Registration number" error={errors.registrationNumber?.message}>
            {(field) => <Input {...field} {...register("registrationNumber")} />}
          </FormField>
          <FormField label="Affiliation / Board" error={errors.affiliationBoard?.message}>
            {(field) => <Input {...field} {...register("affiliationBoard")} placeholder="CBSE" />}
          </FormField>
          <FormField label="School type" error={errors.schoolType?.message}>
            {(field) => (
              <Controller
                name="schoolType"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHOOL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {SCHOOL_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Institution type" error={errors.institutionType?.message}>
            {(field) => (
              <Controller
                name="institutionType"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTITUTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {INSTITUTION_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Established year" error={errors.establishedYear?.message}>
            {(field) => <Input {...field} {...register("establishedYear")} type="number" min={1800} max={2100} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Government &amp; Board IDs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="UDISE+ Code" required error={errors.udisePlusCode?.message}>
            {(field) => <Input {...field} {...register("udisePlusCode", { required: "UDISE+ Code is required" })} placeholder="27060100101" />}
          </FormField>
          <FormField label="UDISE School ID" required error={errors.udiseSchoolId?.message}>
            {(field) => <Input {...field} {...register("udiseSchoolId", { required: "UDISE School ID is required" })} />}
          </FormField>
          <FormField label="Recognition Number" required error={errors.recognitionNumber?.message}>
            {(field) => <Input {...field} {...register("recognitionNumber", { required: "Recognition number is required" })} />}
          </FormField>
          <FormField label="Board Affiliation Number" error={errors.boardAffiliationNumber?.message}>
            {(field) => <Input {...field} {...register("boardAffiliationNumber")} placeholder="Required if affiliated to a board" />}
          </FormField>
          <FormField label="School Code" error={errors.schoolCode?.message}>
            {(field) => <Input {...field} {...register("schoolCode")} placeholder="Required if issued by your board" />}
          </FormField>
          <FormField label="RTE Recognition / Registration No." error={errors.rteRegistrationNumber?.message}>
            {(field) => <Input {...field} {...register("rteRegistrationNumber")} placeholder="Required for RTE-recognized schools" />}
          </FormField>
          <FormField label="NOC Number" error={errors.nocNumber?.message}>
            {(field) => <Input {...field} {...register("nocNumber")} placeholder="Required if a state NOC was issued" />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Official email" error={errors.email?.message}>
            {(field) => <Input {...field} {...register("email")} type="email" />}
          </FormField>
          <FormField label="Phone number" error={errors.phone?.message}>
            {(field) => <Input {...field} {...register("phone")} />}
          </FormField>
          <FormField label="Alternate phone" error={errors.alternatePhone?.message}>
            {(field) => <Input {...field} {...register("alternatePhone")} />}
          </FormField>
          <FormField label="Website" error={errors.website?.message}>
            {(field) => <Input {...field} {...register("website")} />}
          </FormField>
          <FormField label="Address" className="sm:col-span-2" error={errors.address?.message}>
            {(field) => <Input {...field} {...register("address")} />}
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
          <FormField label="PIN / ZIP code" error={errors.pinCode?.message}>
            {(field) => <Input {...field} {...register("pinCode")} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administration information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Principal / Head name" error={errors.principalName?.message}>
            {(field) => <Input {...field} {...register("principalName")} />}
          </FormField>
          <FormField label="Administrator name" error={errors.administratorName?.message}>
            {(field) => <Input {...field} {...register("administratorName")} />}
          </FormField>
          <FormField label="Administrative email" error={errors.administrativeEmail?.message}>
            {(field) => <Input {...field} {...register("administrativeEmail")} type="email" />}
          </FormField>
          <FormField label="Administrative phone" error={errors.administrativePhone?.message}>
            {(field) => <Input {...field} {...register("administrativePhone")} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Time zone" error={errors.timeZone?.message}>
            {(field) => (
              <Controller
                name="timeZone"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select time zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_ZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Currency" error={errors.currency?.message}>
            {(field) => (
              <Controller
                name="currency"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Date format" error={errors.dateFormat?.message}>
            {(field) => (
              <Controller
                name="dateFormat"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select date format" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMATS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Language" error={errors.language?.message}>
            {(field) => (
              <Controller
                name="language"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Week start day" error={errors.weekStartDay?.message}>
            {(field) => (
              <Controller
                name="weekStartDay"
                control={control}
                render={({ field: sf }) => (
                  <Select value={sf.value} onValueChange={sf.onChange}>
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {WEEKDAY_LABELS[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Working days" className="sm:col-span-2">
            {() => (
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm text-foreground">
                    <Checkbox checked={workingDays.includes(day)} onCheckedChange={() => toggleWorkingDay(day)} />
                    {WEEKDAY_LABELS[day]}
                  </label>
                ))}
              </div>
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social media</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Facebook" error={errors.facebookUrl?.message}>
            {(field) => <Input {...field} {...register("facebookUrl")} placeholder="https://facebook.com/..." />}
          </FormField>
          <FormField label="Instagram" error={errors.instagramUrl?.message}>
            {(field) => <Input {...field} {...register("instagramUrl")} placeholder="https://instagram.com/..." />}
          </FormField>
          <FormField label="YouTube" error={errors.youtubeUrl?.message}>
            {(field) => <Input {...field} {...register("youtubeUrl")} placeholder="https://youtube.com/..." />}
          </FormField>
          <FormField label="LinkedIn" error={errors.linkedinUrl?.message}>
            {(field) => <Input {...field} {...register("linkedinUrl")} placeholder="https://linkedin.com/..." />}
          </FormField>
          <FormField label="Twitter / X" error={errors.twitterUrl?.message}>
            {(field) => <Input {...field} {...register("twitterUrl")} placeholder="https://x.com/..." />}
          </FormField>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
