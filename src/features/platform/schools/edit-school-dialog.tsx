"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { platformService } from "@/services/platformService";
import { editSchoolDetailsSchema, type EditSchoolDetailsInput } from "@/lib/validation/platform-school";
import type { ApiError } from "@/services/studentService";
import type { SchoolDetail } from "@/types/platform";

interface EditSchoolDialogProps {
  school: SchoolDetail;
  onClose: () => void;
  onSaved: (school: SchoolDetail) => void;
}

export function EditSchoolDialog({ school, onClose, onSaved }: EditSchoolDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditSchoolDetailsInput>({
    resolver: zodResolver(editSchoolDetailsSchema),
    defaultValues: {
      name: school.name,
      shortName: school.shortName,
      address: school.address ?? "",
      city: school.city ?? "",
      state: school.state ?? "",
      country: school.country ?? "",
      phone: school.phone ?? "",
      email: school.email ?? "",
    },
  });

  async function onSubmit(values: EditSchoolDetailsInput) {
    setServerError(null);
    try {
      const updated = await platformService.updateSchool(school.id, values);
      onSaved(updated);
    } catch (error) {
      setServerError((error as ApiError)?.error ?? "Couldn't save these changes.");
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Edit school details" description="Changes apply immediately — this doesn't affect the school's login link.">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {serverError && (
            <Alert variant="danger" role="alert">
              {serverError}
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="School name" required error={errors.name?.message}>
              {(field) => <Input {...field} {...register("name")} invalid={field.invalid} />}
            </FormField>
            <FormField label="Short name" required error={errors.shortName?.message}>
              {(field) => <Input {...field} {...register("shortName")} invalid={field.invalid} />}
            </FormField>
            <FormField label="Address" className="sm:col-span-2" error={errors.address?.message}>
              {(field) => <Input {...field} {...register("address")} invalid={field.invalid} />}
            </FormField>
            <FormField label="City" error={errors.city?.message}>
              {(field) => <Input {...field} {...register("city")} invalid={field.invalid} />}
            </FormField>
            <FormField label="State" error={errors.state?.message}>
              {(field) => <Input {...field} {...register("state")} invalid={field.invalid} />}
            </FormField>
            <FormField label="Country" error={errors.country?.message}>
              {(field) => <Input {...field} {...register("country")} invalid={field.invalid} />}
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              {(field) => <Input {...field} {...register("phone")} invalid={field.invalid} />}
            </FormField>
            <FormField label="Email" className="sm:col-span-2" error={errors.email?.message}>
              {(field) => <Input {...field} {...register("email")} type="email" invalid={field.invalid} />}
            </FormField>
          </div>
          <ModalFooter className="-mx-5 -mb-4 mt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save changes
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
