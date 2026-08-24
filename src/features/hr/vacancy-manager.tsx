"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Briefcase, Search } from "lucide-react";
import { vacancyService, type VacancyRecord } from "@/services/recruitmentService";
import { hrLookupService } from "@/services/hrService";
import type { HrLookups } from "@/types/hr";
import { VACANCY_STATUSES } from "@/lib/constants/hr";
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
  draft: "neutral",
  open: "success",
  on_hold: "warning",
  closed: "neutral",
  cancelled: "danger",
};

export function VacancyManager() {
  const can = useCan();
  const [rows, setRows] = useState<VacancyRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [lookups, setLookups] = useState<HrLookups | null>(null);

  const load = useCallback(() => {
    setError(false);
    vacancyService
      .list({ q: search || undefined, status: status || undefined })
      .then((r) => setRows(r.data))
      .catch(() => setError(true));
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    hrLookupService.all().then(setLookups).catch(() => undefined);
  }, []);

  async function setVacancyStatus(vacancy: VacancyRecord, next: string) {
    try {
      await vacancyService.update(vacancy.id, { status: next as VacancyRecord["status"] & undefined });
      toast({ title: `Vacancy ${next.replace("_", " ")}`, variant: "success" });
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update the vacancy", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search title or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {VACANCY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can("vacancies", "create") && (
          <Button className="ml-auto" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add vacancy
          </Button>
        )}
      </div>

      {error && <ErrorState description="Couldn't load vacancies." onRetry={load} />}
      {!error && !rows && <TableSkeleton rows={4} columns={6} />}

      {!error && rows?.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No vacancies"
          description="Open a vacancy to start collecting applications."
          action={
            can("vacancies", "create") ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add vacancy
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
                <TableHead>Vacancy</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Positions</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead>Shortlisted</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Closing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.title}</TableCell>
                  <TableCell className="text-muted-foreground">{v.code}</TableCell>
                  <TableCell className="tabular-nums">{v.positionsCount}</TableCell>
                  <TableCell className="tabular-nums">{v.counts?.applications ?? 0}</TableCell>
                  <TableCell className="tabular-nums">{v.counts?.shortlisted ?? 0}</TableCell>
                  <TableCell className="tabular-nums">{v.counts?.joined ?? 0}</TableCell>
                  <TableCell className="whitespace-nowrap">{v.closingDate?.slice(0, 10) ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_TONE[v.status] ?? "neutral"}>{v.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {can("vacancies", "edit") && (
                      <Select value={v.status} onValueChange={(next) => setVacancyStatus(v, next)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VACANCY_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <VacancyModal
        open={creating}
        lookups={lookups}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          load();
        }}
      />
    </div>
  );
}

function VacancyModal({
  open,
  lookups,
  onClose,
  onSaved,
}: {
  open: boolean;
  lookups: HrLookups | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [employeeTypeId, setEmployeeTypeId] = useState("");
  const [positionsCount, setPositionsCount] = useState("1");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [qualification, setQualification] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [description, setDescription] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [status, setStatus] = useState("open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await vacancyService.create({
        title,
        departmentId: departmentId || undefined,
        designationId: designationId || undefined,
        employeeTypeId: employeeTypeId || undefined,
        positionsCount: Number(positionsCount) || 1,
        salaryRangeMin: salaryMin ? Number(salaryMin) : undefined,
        salaryRangeMax: salaryMax ? Number(salaryMax) : undefined,
        requiredQualification: qualification || undefined,
        requiredExperienceYears: experience ? Number(experience) : undefined,
        // Comma-separated in the UI, stored as a JSON array.
        skills: skills ? skills.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        description: description || undefined,
        closingDate: closingDate || undefined,
        status: status as "open",
      });
      toast({ title: "Vacancy created", variant: "success" });
      onSaved();
    } catch (e) {
      const err = e as ApiError;
      setError(err?.error ?? "Couldn't create the vacancy.");
      setFieldErrors((err?.fieldErrors as Record<string, string[]>) ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Add vacancy" description="A reference code is generated automatically." size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          {error && (
            <div className="sm:col-span-2">
              <Alert variant="danger">{error}</Alert>
            </div>
          )}

          <FormField label="Job title" required error={fieldErrors.title?.[0]} className="sm:col-span-2">
            {(f) => <Input {...f} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mathematics Teacher" />}
          </FormField>

          <PickField label="Department" value={departmentId} onChange={setDepartmentId} options={(lookups?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <PickField label="Designation" value={designationId} onChange={setDesignationId} options={(lookups?.designations ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <PickField label="Employee type" value={employeeTypeId} onChange={setEmployeeTypeId} options={(lookups?.employeeTypes ?? []).map((t) => ({ value: t.id, label: t.name }))} />

          <FormField label="Positions" error={fieldErrors.positionsCount?.[0]}>
            {(f) => <Input {...f} type="number" min={1} value={positionsCount} onChange={(e) => setPositionsCount(e.target.value)} />}
          </FormField>

          <FormField label="Salary from" error={fieldErrors.salaryRangeMin?.[0]}>
            {(f) => <Input {...f} type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />}
          </FormField>
          <FormField label="Salary to" error={fieldErrors.salaryRangeMax?.[0]}>
            {(f) => <Input {...f} type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />}
          </FormField>

          <FormField label="Qualification">
            {(f) => <Input {...f} value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="M.Sc / B.Ed" />}
          </FormField>
          <FormField label="Experience (years)">
            {(f) => <Input {...f} type="number" min={0} value={experience} onChange={(e) => setExperience(e.target.value)} />}
          </FormField>

          <FormField label="Skills" description="Comma separated" className="sm:col-span-2">
            {(f) => <Input {...f} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Algebra, Calculus" />}
          </FormField>

          <FormField label="Closing date" error={fieldErrors.closingDate?.[0]}>
            {(f) => <Input {...f} type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />}
          </FormField>

          <FormField label="Status" description="Only open vacancies accept applications">
            {(f) => (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VACANCY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Job description" className="sm:col-span-2">
            {(f) => <Textarea {...f} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </FormField>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Create vacancy
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function PickField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <FormField label={label}>
      {(f) => (
        <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
          <SelectTrigger id={f.id}>
            <SelectValue placeholder={options.length === 0 ? "None available" : "Select"} />
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
    </FormField>
  );
}
