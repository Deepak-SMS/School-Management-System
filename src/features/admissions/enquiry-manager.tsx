"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, Controller, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Check, Copy, ExternalLink, Link2, Plus, Search, UserPlus2 } from "lucide-react";
import {
  admissionEnquiryService,
  type AdmissionEnquiryRecord,
} from "@/services/admissionEnquiryService";
import { admissionEnquiryInputSchema, type AdmissionEnquiryInput } from "@/lib/validation/admission-enquiry";
import { schoolStructureService } from "@/services/schoolStructureService";
import type { SchoolStructure } from "@/types/student";
import { hrLookupService } from "@/services/hrService";
import type { HrLookups } from "@/types/hr";
import {
  ENQUIRY_SOURCES,
  ENQUIRY_SOURCE_LABELS,
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_LABELS,
  EDITABLE_ENQUIRY_STATUSES,
} from "@/lib/constants/admissions";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "info"> = {
  new: "neutral",
  contacted: "info",
  interested: "warning",
  not_interested: "danger",
  converted: "success",
};

export function EnquiryManager() {
  const can = useCan();
  const [rows, setRows] = useState<AdmissionEnquiryRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdmissionEnquiryRecord | null>(null);
  const [linking, setLinking] = useState<AdmissionEnquiryRecord | null>(null);
  const [structure, setStructure] = useState<SchoolStructure | null>(null);
  const [lookups, setLookups] = useState<HrLookups | null>(null);

  const load = useCallback(() => {
    setError(false);
    admissionEnquiryService
      .list({ q: search || undefined, status: status || undefined })
      .then((r) => setRows(r.data))
      .catch(() => setError(true));
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    schoolStructureService.get().then(setStructure).catch(() => undefined);
    hrLookupService.all().then(setLookups).catch(() => undefined);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full max-w-xs">
            <Input
              leadingIcon={<Search />}
              placeholder="Search parent or child name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status || "queue"} onValueChange={(v) => setStatus(v === "queue" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="queue">Working queue</SelectItem>
              {ENQUIRY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ENQUIRY_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {can("admissionEnquiries", "create") && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New enquiry
          </Button>
        )}
      </div>

      {error && <ErrorState description="Couldn't load admission enquiries." onRetry={load} />}
      {!error && !rows && <TableSkeleton rows={5} columns={6} />}

      {!error && rows?.length === 0 && (
        <EmptyState
          icon={UserPlus2}
          title="No enquiries"
          description="Log a walk-in, phone or website enquiry to start tracking it toward an application."
        />
      )}

      {!error && rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Child</TableHead>
                <TableHead>Parent / guardian</TableHead>
                <TableHead>Interested class</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.childName}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className="text-sm text-foreground">{row.parentName}</span>
                      <span className="text-muted-foreground">{row.parentPhone}</span>
                    </div>
                  </TableCell>
                  <TableCell>{row.interestedClass?.name ?? "—"}</TableCell>
                  <TableCell>{ENQUIRY_SOURCE_LABELS[row.source as keyof typeof ENQUIRY_SOURCE_LABELS] ?? row.source}</TableCell>
                  <TableCell>{row.assignedTo?.fullName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_TONE[row.status] ?? "neutral"}>
                      {ENQUIRY_STATUS_LABELS[row.status as keyof typeof ENQUIRY_STATUS_LABELS] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {row.status !== "converted" && can("admissionEnquiries", "edit") && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                          Edit
                        </Button>
                      )}
                      {row.status !== "converted" && can("admissionEnquiries", "convert") && (
                        <Button variant="ghost" size="sm" onClick={() => setLinking(row)}>
                          <Link2 className="size-4" /> Generate link
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(creating || editing) && (
        <EnquiryFormModal
          enquiry={editing}
          structure={structure}
          lookups={lookups}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}

      {linking && <GenerateLinkModal enquiry={linking} onClose={() => setLinking(null)} />}
    </div>
  );
}

type FormValues = z.input<typeof admissionEnquiryInputSchema>;
type Form = UseFormReturn<FormValues, unknown, AdmissionEnquiryInput>;

function EnquiryFormModal({
  enquiry,
  structure,
  lookups,
  onClose,
  onSaved,
}: {
  enquiry: AdmissionEnquiryRecord | null;
  structure: SchoolStructure | null;
  lookups: HrLookups | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(enquiry);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues, unknown, AdmissionEnquiryInput>({
    resolver: zodResolver(admissionEnquiryInputSchema),
    defaultValues: enquiry
      ? {
          parentName: enquiry.parentName,
          parentPhone: enquiry.parentPhone,
          parentEmail: enquiry.parentEmail ?? undefined,
          childName: enquiry.childName,
          childDob: enquiry.childDob?.slice(0, 10) ?? undefined,
          interestedClassId: enquiry.interestedClassId ?? undefined,
          source: enquiry.source as (typeof ENQUIRY_SOURCES)[number],
          status: enquiry.status === "converted" ? undefined : (enquiry.status as (typeof EDITABLE_ENQUIRY_STATUSES)[number]),
          followUpDate: enquiry.followUpDate?.slice(0, 10) ?? undefined,
          assignedToId: enquiry.assignedToId ?? undefined,
          notes: enquiry.notes ?? undefined,
        }
      : { source: "walk_in" },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  async function submit(values: AdmissionEnquiryInput) {
    setServerError(null);
    try {
      if (isEdit && enquiry) {
        await admissionEnquiryService.update(enquiry.id, values);
        toast({ title: "Enquiry updated", variant: "success" });
      } else {
        await admissionEnquiryService.create(values);
        toast({ title: "Enquiry logged", variant: "success" });
      }
      onSaved();
    } catch (e) {
      setServerError((e as ApiError)?.error ?? "Couldn't save the enquiry.");
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={isEdit ? "Edit enquiry" : "Log admission enquiry"} size="lg">
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          {serverError && <Alert variant="danger">{serverError}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Child's name" required error={errors.childName?.message}>
              {(f) => <Input {...f} {...register("childName")} />}
            </FormField>
            <FormField label="Date of birth" error={errors.childDob?.message}>
              {(f) => <Input {...f} type="date" {...register("childDob")} />}
            </FormField>
            <FormField label="Parent / guardian name" required error={errors.parentName?.message}>
              {(f) => <Input {...f} {...register("parentName")} />}
            </FormField>
            <FormField label="Parent phone" required error={errors.parentPhone?.message}>
              {(f) => <Input {...f} {...register("parentPhone")} />}
            </FormField>
            <FormField label="Parent email" error={errors.parentEmail?.message}>
              {(f) => <Input {...f} type="email" {...register("parentEmail")} />}
            </FormField>
            <SelectField control={control} name="interestedClassId" label="Interested class"
              placeholder="Select class" options={(structure?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))} />
            <SelectField control={control} name="source" label="Source"
              options={ENQUIRY_SOURCES.map((s) => ({ value: s, label: ENQUIRY_SOURCE_LABELS[s] }))} />
            {isEdit && (
              <SelectField control={control} name="status" label="Status" placeholder="Select status"
                options={EDITABLE_ENQUIRY_STATUSES.map((s) => ({ value: s, label: ENQUIRY_STATUS_LABELS[s] }))} />
            )}
            <SelectField control={control} name="assignedToId" label="Assign to" placeholder="Unassigned"
              options={(lookups?.managers ?? []).map((m) => ({ value: m.id, label: m.fullName }))} />
            <FormField label="Follow-up date">
              {(f) => <Input {...f} type="date" {...register("followUpDate")} />}
            </FormField>
          </div>

          <FormField label="Notes">
            {(f) => <Textarea {...f} rows={3} {...register("notes")} />}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {isEdit ? "Save changes" : "Log enquiry"}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}

function SelectField({
  control,
  name,
  label,
  options,
  placeholder,
  required,
}: {
  control: Form["control"];
  name: keyof FormValues;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <FormField label={label} required={required}>
      {(f) => (
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <Select value={(field.value as string) ?? ""} onValueChange={field.onChange}>
              <SelectTrigger id={f.id}>
                <SelectValue placeholder={placeholder ?? "Select"} />
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

function GenerateLinkModal({ enquiry, onClose }: { enquiry: AdmissionEnquiryRecord; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function run() {
      try {
        const result = await admissionEnquiryService.generateLink(enquiry.id);
        setUrl(result.url);
      } catch (e) {
        setError((e as ApiError)?.error ?? "Couldn't generate the link.");
      } finally {
        setBusy(false);
      }
    }
    run();
  }, [enquiry.id]);

  const displayUrl = useMemo(() => url ?? "", [url]);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy — select the link and copy it manually.", variant: "danger" });
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title={`Application link — ${enquiry.childName}`}
        description="Share this with the parent. Once they submit it, this enquiry is marked converted and the submission appears under Applications."
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}
          {busy && <p className="text-sm text-muted-foreground">Generating link…</p>}

          {url && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
                {displayUrl}
              </code>
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" /> Open
                </a>
              </Button>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
