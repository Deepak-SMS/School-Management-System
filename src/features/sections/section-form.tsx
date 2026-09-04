"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { sectionInputSchema, type SectionInput } from "@/lib/validation/section";

type SectionFormValues = z.input<typeof sectionInputSchema>;
import { classService } from "@/services/classService";
import { staffService } from "@/services/staffService";
import type { ClassRecord } from "@/types/class";
import type { StaffRecord } from "@/types/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert } from "@/components/ui/alert";
import { Modal, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/loading-state";
import type { ApiError } from "@/services/studentService";

/** The Class/Section create routes return this exact phrasing for a name/code clash — see src/app/api/sections/route.ts. */
function isDuplicateError(error: ApiError): boolean {
  return typeof error?.error === "string" && error.error.includes("already exists for");
}

/** Quick-pick letters for the "multiple sections" tab. */
const QUICK_SECTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Section code follows the class ID convention, e.g. "CLS01/A" for Class 1's Section A — see src/lib/validation/class.ts. */
function deriveSectionCode(classCode: string | undefined, sectionName: string): string {
  if (!classCode) return "";
  const suffix = sectionName
    .replace(/^section\s+/i, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return suffix ? `${classCode}/${suffix}` : "";
}

interface SectionFormProps {
  defaultValues?: Partial<SectionInput>;
  onSubmit: (input: SectionInput) => Promise<void>;
  /** Bulk path for the "multiple sections" tab — one call per section is deliberately not routed through `onSubmit`, so the single-section duplicate-name modal below doesn't fire for a batch (the caller reports partial success/failure itself, same pattern classes/new/page.tsx already used for its own quick-add). */
  onSubmitMultiple?: (inputs: SectionInput[]) => Promise<void>;
  submitLabel?: string;
}

export function SectionForm({ defaultValues, onSubmit, onSubmitMultiple, submitLabel = "Add section" }: SectionFormProps) {
  const [mode, setMode] = useState<"single" | "multiple">("single");
  const [selectedLetters, setSelectedLetters] = useState<Set<string>>(new Set());
  const [customNames, setCustomNames] = useState("");
  const [multiError, setMultiError] = useState<string | null>(null);
  const [multiSubmitting, setMultiSubmitting] = useState(false);
  const [classes, setClasses] = useState<ClassRecord[] | null>(null);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SectionFormValues, unknown, SectionInput>({
    resolver: zodResolver(sectionInputSchema),
    defaultValues: { status: "active", ...defaultValues },
  });

  useEffect(() => {
    classService.list({ pageSize: 100, status: "active" }).then((r) => setClasses(r.data)).catch(() => setClasses([]));
    staffService.list({ pageSize: 200 }).then((r) => setStaff(r.data)).catch(() => {});
  }, []);

  const selectedClassId = watch("classId");
  const selectedClass = classes?.find((c) => c.id === selectedClassId);
  const nameValue = watch("name");

  useEffect(() => {
    if (selectedClass) {
      setValue("academicYearId", selectedClass.academicYear.id);
      setValue("campusId", selectedClass.campus.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass?.id]);

  useEffect(() => {
    setValue("code", deriveSectionCode(selectedClass?.code, nameValue ?? ""), { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass?.code, nameValue]);

  function toggleLetter(letter: string) {
    setSelectedLetters((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
    setMultiError(null);
  }

  const pendingNames = [
    ...QUICK_SECTION_LETTERS.filter((l) => selectedLetters.has(l)),
    ...customNames
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean),
  ];

  async function handleMultipleSubmit() {
    setServerError(null);
    setMultiError(null);
    if (!selectedClass) {
      setMultiError("Select a class first.");
      return;
    }
    if (pendingNames.length === 0) {
      setMultiError("Pick at least one section to add.");
      return;
    }
    const inputs: SectionInput[] = pendingNames.map((n) => ({
      name: `Section ${n}`,
      code: deriveSectionCode(selectedClass.code, n),
      classId: selectedClass.id,
      academicYearId: selectedClass.academicYear.id,
      campusId: selectedClass.campus.id,
      status: "active",
    }));
    setMultiSubmitting(true);
    try {
      await onSubmitMultiple?.(inputs);
      setSelectedLetters(new Set());
      setCustomNames("");
    } catch (error) {
      setServerError((error as ApiError)?.error ?? "Something went wrong. Please try again.");
    } finally {
      setMultiSubmitting(false);
    }
  }

  async function handleFormSubmit(values: SectionInput) {
    setServerError(null);
    setDuplicateMessage(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const apiError = error as ApiError;
      const message = apiError?.error ?? "Something went wrong. Please try again.";
      if (isDuplicateError(apiError)) {
        setDuplicateMessage(message);
      } else {
        setServerError(message);
      }
    }
  }

  if (!classes) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5 text-primary-600" />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        // The "multiple sections" tab has its own button (type="button", not
        // wired to this handler) — this guard only stops Enter-in-a-text-field
        // from falling through to the single-section validation while that
        // tab is active.
        if (mode === "multiple") {
          e.preventDefault();
          return;
        }
        void handleSubmit(handleFormSubmit)(e);
      }}
      className="flex flex-col gap-6"
    >
      {serverError && <Alert variant="danger" title="Couldn't save section">{serverError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Section details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Class" required error={errors.classId?.message}>
              {(field) => (
                <Controller
                  name="classId"
                  control={control}
                  render={({ field: selectField }) => (
                    <Select value={selectField.value} onValueChange={selectField.onChange}>
                      <SelectTrigger id={field.id}>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.academicYear.label})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <FormField label="Academic year">
              {() => <Input value={selectedClass?.academicYear.label ?? "Select a class first"} disabled readOnly />}
            </FormField>
            <FormField label="Campus">{() => <Input value={selectedClass?.campus.name ?? "Select a class first"} disabled readOnly />}</FormField>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "multiple")}>
            <TabsList>
              <TabsTrigger value="single">Single section</TabsTrigger>
              {onSubmitMultiple && <TabsTrigger value="multiple">Multiple sections</TabsTrigger>}
            </TabsList>

            <TabsContent value="single">
              <div className="grid gap-4 pt-4 sm:grid-cols-2">
                <FormField label="Section name" required error={errors.name?.message}>
                  {(field) => <Input {...field} {...register("name")} placeholder="Section A" />}
                </FormField>
                <FormField label="Section code" required description='Follows the class ID automatically, e.g. "CLS01/A"' error={errors.code?.message}>
                  {() => <Input value={watch("code") || "Select a class and enter a name first"} disabled readOnly />}
                </FormField>
                <FormField label="Classroom / Room" error={errors.room?.message}>
                  {(field) => <Input {...field} {...register("room")} placeholder="Room 204" />}
                </FormField>
                <FormField label="Class teacher" error={errors.classTeacherId?.message}>
                  {(field) => (
                    <Controller
                      name="classTeacherId"
                      control={control}
                      render={({ field: selectField }) => (
                        <Select value={selectField.value} onValueChange={selectField.onChange}>
                          <SelectTrigger id={field.id}>
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                          <SelectContent>
                            {staff.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                </FormField>
                <FormField label="Capacity" error={errors.capacity?.message}>
                  {(field) => <Input {...field} {...register("capacity")} type="number" min={1} />}
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
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                </FormField>
              </div>
            </TabsContent>

            {onSubmitMultiple && (
              <TabsContent value="multiple">
                <div className="flex flex-col gap-4 pt-4">
                  <CardDescription>
                    Pick section letters, add custom names, or both — each becomes its own section for the class selected above (room, class teacher and capacity aren&apos;t set here; edit those from the section afterward).
                  </CardDescription>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Sections</span>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_SECTION_LETTERS.map((letter) => {
                        const active = selectedLetters.has(letter);
                        return (
                          <button
                            key={letter}
                            type="button"
                            onClick={() => toggleLetter(letter)}
                            aria-pressed={active}
                            className={
                              "flex size-9 items-center justify-center rounded-md border text-sm font-medium transition-colors " +
                              (active
                                ? "border-primary-600 bg-primary-600 text-white"
                                : "border-border-strong bg-surface text-foreground hover:border-primary-400")
                            }
                          >
                            {letter}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <FormField label="Additional section names" description='Comma-separated, e.g. "Science, Commerce" — for sections beyond a single letter.'>
                    {(field) => (
                      <Input
                        {...field}
                        value={customNames}
                        onChange={(e) => {
                          setCustomNames(e.target.value);
                          setMultiError(null);
                        }}
                        placeholder="Science, Commerce"
                      />
                    )}
                  </FormField>
                  {multiError && <p className="text-sm text-danger-600">{multiError}</p>}
                  {pendingNames.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Will create: {pendingNames.map((n) => `Section ${n}`).join(", ")}
                    </p>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {mode === "single" || !onSubmitMultiple ? (
          <Button type="submit" isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        ) : (
          <Button type="button" isLoading={multiSubmitting} onClick={handleMultipleSubmit} disabled={pendingNames.length === 0}>
            Add {pendingNames.length > 0 ? pendingNames.length : ""} section{pendingNames.length === 1 ? "" : "s"}
          </Button>
        )}
      </div>

      <Modal open={Boolean(duplicateMessage)} onOpenChange={(open) => !open && setDuplicateMessage(null)}>
        <ModalContent title="Section already exists" description={duplicateMessage ?? undefined} size="sm">
          <ModalFooter className="-mx-5 -mb-4 mt-2">
            <Button onClick={() => setDuplicateMessage(null)}>Got it</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </form>
  );
}
