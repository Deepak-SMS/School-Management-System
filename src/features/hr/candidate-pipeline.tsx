"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Users, UserCheck, ArrowRight, CalendarPlus, FileSignature } from "lucide-react";
import {
  applicationService,
  vacancyService,
  type ApplicationRecord,
  type VacancyRecord,
} from "@/services/recruitmentService";
import { hrLookupService } from "@/services/hrService";
import type { HrLookups } from "@/types/hr";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/constants/hr";
import { allowedTransitions } from "@/lib/recruitment-pipeline";
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

const STAGE_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "info"> = {
  new: "neutral",
  screening: "info",
  shortlisted: "info",
  interview: "warning",
  selected: "success",
  offered: "success",
  joined: "success",
  rejected: "danger",
  withdrawn: "neutral",
  hold: "warning",
};

export function CandidatePipeline() {
  const can = useCan();
  const [rows, setRows] = useState<ApplicationRecord[] | null>(null);
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([]);
  const [lookups, setLookups] = useState<HrLookups | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [vacancyId, setVacancyId] = useState("");
  const [moving, setMoving] = useState<ApplicationRecord | null>(null);
  const [scheduling, setScheduling] = useState<ApplicationRecord | null>(null);

  const load = useCallback(() => {
    setError(false);
    applicationService
      .list({ q: search || undefined, status: status || undefined, vacancyId: vacancyId || undefined, pageSize: 100 })
      .then((r) => setRows(r.data))
      .catch(() => setError(true));
  }, [search, status, vacancyId]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    vacancyService.list({ pageSize: 100 }).then((r) => setVacancies(r.data)).catch(() => undefined);
    hrLookupService.all().then(setLookups).catch(() => undefined);
  }, []);

  async function convert(app: ApplicationRecord) {
    try {
      const result = await applicationService.convert(app.id);
      toast({
        title: "Candidate converted to employee",
        description: `${result.fullName} · ${result.employeeId}`,
        variant: "success",
      });
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't convert the candidate", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search candidate or vacancy…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Any stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any stage</SelectItem>
            {APPLICATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={vacancyId || "all"} onValueChange={(v) => setVacancyId(v === "all" ? "" : v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Any vacancy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any vacancy</SelectItem>
            {vacancies.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.title} ({v.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState description="Couldn't load applications." onRetry={load} />}
      {!error && !rows && <TableSkeleton rows={5} columns={6} />}

      {!error && rows?.length === 0 && (
        <EmptyState
          icon={Users}
          title="No applications"
          description="Add a candidate and apply them to an open vacancy to start the pipeline."
        />
      )}

      {!error && rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Vacancy</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Interviews</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((app) => {
                const stage = app.status as ApplicationStatus;
                const canConvert = stage === "offered" || stage === "selected";
                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {app.candidate.firstName} {app.candidate.lastName ?? ""}
                        </span>
                        <span className="text-xs text-muted-foreground">{app.candidate.email ?? app.candidate.phone ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{app.vacancy.title}</span>
                        <span className="text-xs text-muted-foreground">{app.vacancy.code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{app.appliedDate.slice(0, 10)}</TableCell>
                    <TableCell className="tabular-nums">{app.screeningScore ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{app._count?.interviews ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={STAGE_TONE[stage] ?? "neutral"}>{APPLICATION_STATUS_LABELS[stage] ?? stage}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {can("interviews", "create") && ["shortlisted", "interview"].includes(stage) && (
                          <Button variant="ghost" size="sm" onClick={() => setScheduling(app)}>
                            <CalendarPlus className="size-4" /> Interview
                          </Button>
                        )}
                        {can("candidates", "convert") && canConvert && (
                          <Button variant="ghost" size="sm" onClick={() => convert(app)}>
                            <UserCheck className="size-4" /> Convert
                          </Button>
                        )}
                        {can("candidates", "screen") && allowedTransitions(stage).length > 0 && (
                          <Button variant="ghost" size="sm" onClick={() => setMoving(app)}>
                            <ArrowRight className="size-4" /> Move
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {moving && (
        <MoveStageModal
          application={moving}
          lookups={lookups}
          onClose={() => setMoving(null)}
          onMoved={() => {
            setMoving(null);
            load();
          }}
        />
      )}

      {scheduling && (
        <ScheduleInterviewModal
          application={scheduling}
          lookups={lookups}
          onClose={() => setScheduling(null)}
          onScheduled={() => {
            setScheduling(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MoveStageModal({
  application,
  lookups,
  onClose,
  onMoved,
}: {
  application: ApplicationRecord;
  lookups: HrLookups | null;
  onClose: () => void;
  onMoved: () => void;
}) {
  const from = application.status as ApplicationStatus;
  const options = allowedTransitions(from);
  const [to, setTo] = useState<ApplicationStatus>(options[0]);
  const [note, setNote] = useState("");
  const [score, setScore] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [proposedSalary, setProposedSalary] = useState(String(application.proposedSalary ?? ""));
  const [proposedDesignationId, setProposedDesignationId] = useState("");
  const [proposedJoiningDate, setProposedJoiningDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Screening is a scored decision; selection captures the terms the offer is
  // built from. Both are stage moves, so they share this dialog.
  const isScreening = from === "new" || from === "screening";
  const isSelecting = to === "selected";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (isScreening && (to === "shortlisted" || to === "rejected" || to === "hold")) {
        await applicationService.screen(application.id, {
          outcome: to,
          screeningScore: score ? Number(score) : undefined,
          screeningComments: note || undefined,
          rejectionReason: rejectionReason || undefined,
        });
      } else {
        await applicationService.setStage(application.id, {
          status: to,
          note: note || undefined,
          rejectionReason: rejectionReason || undefined,
          ...(isSelecting && {
            proposedSalary: proposedSalary ? Number(proposedSalary) : undefined,
            proposedDesignationId: proposedDesignationId || undefined,
            proposedJoiningDate: proposedJoiningDate || undefined,
          }),
        });
      }
      toast({ title: `Moved to ${APPLICATION_STATUS_LABELS[to]}`, variant: "success" });
      onMoved();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't move the application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title={`Move ${application.candidate.firstName} forward`}
        description={`Currently at "${APPLICATION_STATUS_LABELS[from]}". Only valid next stages are offered.`}
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Move to" required>
            {(f) => (
              <Select value={to} onValueChange={(v) => setTo(v as ApplicationStatus)}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((s) => (
                    <SelectItem key={s} value={s}>
                      {APPLICATION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          {isScreening && (
            <FormField label="Screening score" description="Out of 100">
              {(f) => <Input {...f} type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />}
            </FormField>
          )}

          {isSelecting && (
            <>
              <FormField label="Proposed salary" description="Carried onto the offer and the employee record">
                {(f) => <Input {...f} type="number" min={0} value={proposedSalary} onChange={(e) => setProposedSalary(e.target.value)} />}
              </FormField>
              <FormField label="Proposed designation">
                {(f) => (
                  <Select value={proposedDesignationId} onValueChange={setProposedDesignationId}>
                    <SelectTrigger id={f.id}>
                      <SelectValue placeholder="Select designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookups?.designations ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField label="Proposed joining date">
                {(f) => <Input {...f} type="date" value={proposedJoiningDate} onChange={(e) => setProposedJoiningDate(e.target.value)} />}
              </FormField>
            </>
          )}

          {to === "rejected" && (
            <FormField label="Rejection reason" description="Kept on the application record">
              {(f) => <Textarea {...f} rows={2} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />}
            </FormField>
          )}

          <FormField label="Note" description="Added to the candidate's history">
            {(f) => <Textarea {...f} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Move to {APPLICATION_STATUS_LABELS[to]}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function ScheduleInterviewModal({
  application,
  lookups,
  onClose,
  onScheduled,
}: {
  application: ApplicationRecord;
  lookups: HrLookups | null;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [mode, setMode] = useState("in_person");
  const [roundName, setRoundName] = useState("");
  const [location, setLocation] = useState("");
  const [panelStaffId, setPanelStaffId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { interviewService } = await import("@/services/recruitmentService");
      await interviewService.schedule({
        applicationId: application.id,
        scheduledAt: new Date(scheduledAt).toISOString(),
        mode: mode as "in_person",
        roundName: roundName || undefined,
        location: location || undefined,
        panelStaffIds: panelStaffId ? [panelStaffId] : undefined,
      });
      toast({ title: "Interview scheduled", variant: "success" });
      onScheduled();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't schedule the interview.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title={`Schedule interview — ${application.candidate.firstName}`}
        description={`${application.vacancy.title} (${application.vacancy.code}). The round number is assigned automatically.`}
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Date and time" required>
            {(f) => (
              <Input {...f} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            )}
          </FormField>

          <FormField label="Round name" description="e.g. Subject round, Demo class">
            {(f) => <Input {...f} value={roundName} onChange={(e) => setRoundName(e.target.value)} />}
          </FormField>

          <FormField label="Mode">
            {(f) => (
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">In person</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label={mode === "video" ? "Meeting link" : "Location"}>
            {(f) => <Input {...f} value={location} onChange={(e) => setLocation(e.target.value)} />}
          </FormField>

          <FormField label="Panel member">
            {(f) => (
              <Select value={panelStaffId} onValueChange={setPanelStaffId}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Select interviewer" />
                </SelectTrigger>
                <SelectContent>
                  {(lookups?.managers ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy} disabled={!scheduledAt}>
              <FileSignature className="size-4" /> Schedule
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
