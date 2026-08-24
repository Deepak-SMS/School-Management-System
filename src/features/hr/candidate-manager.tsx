"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Users, Send } from "lucide-react";
import {
  candidateService,
  vacancyService,
  applicationService,
  type CandidateRecord,
  type VacancyRecord,
} from "@/services/recruitmentService";
import { CANDIDATE_SOURCES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/constants/hr";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function CandidateManager() {
  const can = useCan();
  const [rows, setRows] = useState<CandidateRecord[] | null>(null);
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([]);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [applying, setApplying] = useState<CandidateRecord | null>(null);

  const load = useCallback(() => {
    setError(false);
    candidateService
      .list({ q: search || undefined, pageSize: 100 })
      .then((r) => setRows(r.data))
      .catch(() => setError(true));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    vacancyService.list({ status: "open", pageSize: 100 }).then((r) => setVacancies(r.data)).catch(() => undefined);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {can("candidates", "create") && (
          <Button className="ml-auto" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add candidate
          </Button>
        )}
      </div>

      {error && <ErrorState description="Couldn't load candidates." onRetry={load} />}
      {!error && !rows && <TableSkeleton rows={5} columns={6} />}

      {!error && rows?.length === 0 && (
        <EmptyState
          icon={Users}
          title="No candidates yet"
          description="Candidates live in a shared talent pool — one record per person, applied to as many vacancies as you like."
          action={
            can("candidates", "create") ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add candidate
              </Button>
            ) : undefined
          }
        />
      )}

      {!error && rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Current role</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {c.firstName} {c.lastName ?? ""}
                      </span>
                      <span className="text-xs text-muted-foreground">{c.email ?? c.phone ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{c.currentDesignation ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{c.currentOrganization ?? ""}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {c.totalExperienceYears != null ? `${c.totalExperienceYears} yr` : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {c.expectedSalary != null ? c.expectedSalary.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    {c.applications.length === 0 ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {c.applications.map((a) => (
                          <Badge key={a.id} variant={a.status === "joined" ? "success" : "neutral"}>
                            {APPLICATION_STATUS_LABELS[a.status as ApplicationStatus] ?? a.status}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.source?.replace("_", " ") ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {c.convertedStaff ? (
                      <Badge variant="success">Hired · {c.convertedStaff.employeeId}</Badge>
                    ) : (
                      can("candidates", "create") && (
                        <Button variant="ghost" size="sm" onClick={() => setApplying(c)}>
                          <Send className="size-4" /> Apply to vacancy
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CandidateModal open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />

      {applying && (
        <ApplyModal
          candidate={applying}
          vacancies={vacancies}
          onClose={() => setApplying(null)}
          onApplied={() => {
            setApplying(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CandidateModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    currentOrganization: "", currentDesignation: "", totalExperienceYears: "",
    expectedSalary: "", noticePeriodDays: "", highestQualification: "", university: "", passingYear: "",
    source: "referral",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await candidateService.create({
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        currentOrganization: form.currentOrganization || undefined,
        currentDesignation: form.currentDesignation || undefined,
        totalExperienceYears: form.totalExperienceYears ? Number(form.totalExperienceYears) : undefined,
        expectedSalary: form.expectedSalary ? Number(form.expectedSalary) : undefined,
        noticePeriodDays: form.noticePeriodDays ? Number(form.noticePeriodDays) : undefined,
        highestQualification: form.highestQualification || undefined,
        university: form.university || undefined,
        passingYear: form.passingYear ? Number(form.passingYear) : undefined,
        source: form.source as "referral",
      });
      toast({ title: "Candidate added", variant: "success" });
      onSaved();
    } catch (e) {
      const err = e as ApiError;
      setError(err?.error ?? "Couldn't add the candidate.");
      setFieldErrors((err?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Add candidate" size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          {error && (
            <div className="sm:col-span-2">
              <Alert variant="danger">{error}</Alert>
            </div>
          )}

          <FormField label="First name" required error={fieldErrors.firstName?.[0]}>
            {(f) => <Input {...f} value={form.firstName} onChange={set("firstName")} />}
          </FormField>
          <FormField label="Last name">
            {(f) => <Input {...f} value={form.lastName} onChange={set("lastName")} />}
          </FormField>
          <FormField label="Email" error={fieldErrors.email?.[0]} description="Used to spot duplicates in the talent pool">
            {(f) => <Input {...f} type="email" value={form.email} onChange={set("email")} />}
          </FormField>
          <FormField label="Phone" error={fieldErrors.phone?.[0]}>
            {(f) => <Input {...f} value={form.phone} onChange={set("phone")} />}
          </FormField>
          <FormField label="Current organization">
            {(f) => <Input {...f} value={form.currentOrganization} onChange={set("currentOrganization")} />}
          </FormField>
          <FormField label="Current designation">
            {(f) => <Input {...f} value={form.currentDesignation} onChange={set("currentDesignation")} />}
          </FormField>
          <FormField label="Experience (years)">
            {(f) => <Input {...f} type="number" min={0} value={form.totalExperienceYears} onChange={set("totalExperienceYears")} />}
          </FormField>
          <FormField label="Notice period (days)">
            {(f) => <Input {...f} type="number" min={0} value={form.noticePeriodDays} onChange={set("noticePeriodDays")} />}
          </FormField>
          <FormField label="Expected salary">
            {(f) => <Input {...f} type="number" min={0} value={form.expectedSalary} onChange={set("expectedSalary")} />}
          </FormField>
          <FormField label="Highest qualification">
            {(f) => <Input {...f} value={form.highestQualification} onChange={set("highestQualification")} />}
          </FormField>
          <FormField label="University / board">
            {(f) => <Input {...f} value={form.university} onChange={set("university")} />}
          </FormField>
          <FormField label="Passing year">
            {(f) => <Input {...f} type="number" value={form.passingYear} onChange={set("passingYear")} />}
          </FormField>
          <FormField label="Source">
            {(f) => (
              <Select value={form.source} onValueChange={(v) => setForm((s) => ({ ...s, source: v }))}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANDIDATE_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Add candidate
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function ApplyModal({
  candidate,
  vacancies,
  onClose,
  onApplied,
}: {
  candidate: CandidateRecord;
  vacancies: VacancyRecord[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const applied = new Set(candidate.applications.map((a) => a.vacancyId));
  const available = vacancies.filter((v) => !applied.has(v.id));
  const [vacancyId, setVacancyId] = useState(available[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await applicationService.create({ candidateId: candidate.id, vacancyId });
      toast({ title: "Application created", variant: "success" });
      onApplied();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't create the application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title={`Apply ${candidate.firstName} to a vacancy`}
        description="Only open vacancies they haven't already applied to are listed."
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          {available.length === 0 ? (
            <Alert variant="info">
              There are no open vacancies left for this candidate — they have applied to all of them, or none are open.
            </Alert>
          ) : (
            <FormField label="Vacancy" required>
              {(f) => (
                <Select value={vacancyId} onValueChange={setVacancyId}>
                  <SelectTrigger id={f.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.title} ({v.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy} disabled={!vacancyId || available.length === 0}>
              Create application
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
