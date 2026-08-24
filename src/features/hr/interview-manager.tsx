"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Star } from "lucide-react";
import { interviewService, type InterviewRecord } from "@/services/recruitmentService";
import { INTERVIEW_STATUSES, INTERVIEW_OUTCOMES, TEACHING_INTERVIEW_CRITERIA } from "@/lib/constants/hr";
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
  scheduled: "info",
  completed: "success",
  cancelled: "neutral",
  no_show: "danger",
};

export function InterviewManager() {
  const can = useCan();
  const [rows, setRows] = useState<InterviewRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState("");
  const [evaluating, setEvaluating] = useState<InterviewRecord | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    interviewService
      .list({ status: status || undefined })
      .then((r) => {
        if (cancelled) return;
        setRows(r.data);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status, reloadKey]);

  if (error) return <ErrorState description="Couldn't load interviews." onRetry={load} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {INTERVIEW_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!rows && <TableSkeleton rows={4} columns={6} />}

      {rows?.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="No interviews scheduled"
          description="Schedule interviews from the recruitment pipeline once a candidate is shortlisted."
        />
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Vacancy</TableHead>
                <TableHead>Round</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Panel</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((iv) => (
                <TableRow key={iv.id}>
                  <TableCell className="font-medium">
                    {iv.application.candidate.firstName} {iv.application.candidate.lastName ?? ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{iv.application.vacancy.title}</span>
                      <span className="text-xs text-muted-foreground">{iv.application.vacancy.code}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {iv.roundName ? `${iv.roundNumber} · ${iv.roundName}` : iv.roundNumber}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(iv.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>{iv.mode.replace("_", " ")}</TableCell>
                  <TableCell>{iv.panel.map((p) => p.staff.fullName).join(", ") || "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    {iv.overallScore != null ? iv.overallScore.toFixed(1) : "—"}
                    {iv.evaluations.length > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">({iv.evaluations.length})</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_TONE[iv.status] ?? "neutral"}>{iv.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {can("interviews", "evaluate") && (
                      <Button variant="ghost" size="sm" onClick={() => setEvaluating(iv)}>
                        <Star className="size-4" /> Evaluate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {evaluating && (
        <EvaluateModal
          interview={evaluating}
          onClose={() => setEvaluating(null)}
          onSaved={() => {
            setEvaluating(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EvaluateModal({
  interview,
  onClose,
  onSaved,
}: {
  interview: InterviewRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scores, setScores] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState("hire");
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The mean of the criterion ratings, shown live so the reviewer sees where
  // their scorecard lands before submitting. It informs; it does not decide.
  const numeric = Object.values(scores).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const mean = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const parsed: Record<string, number> = {};
      for (const [k, v] of Object.entries(scores)) {
        const n = Number(v);
        if (Number.isFinite(n) && v !== "") parsed[k] = n;
      }
      await interviewService.evaluate(interview.id, {
        scores: Object.keys(parsed).length ? parsed : undefined,
        overallScore: mean ?? undefined,
        recommendation,
        comments: comments || undefined,
      });
      toast({ title: "Evaluation submitted", variant: "success" });
      onSaved();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't submit the evaluation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent
        title={`Evaluate ${interview.application.candidate.firstName}`}
        description={`${interview.application.vacancy.title} · Round ${interview.roundNumber}. Scores inform the decision — a person still makes it.`}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <div className="grid gap-3 sm:grid-cols-2">
            {TEACHING_INTERVIEW_CRITERIA.map((c) => (
              <FormField key={c.key} label={c.label} description="0–10">
                {(f) => (
                  <Input
                    {...f}
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={scores[c.key] ?? ""}
                    onChange={(e) => setScores((s) => ({ ...s, [c.key]: e.target.value }))}
                  />
                )}
              </FormField>
            ))}
          </div>

          {mean !== null && (
            <Alert variant="info">
              Average score: <strong>{mean.toFixed(1)}</strong> / 10 across {numeric.length} criteria.
            </Alert>
          )}

          <FormField label="Recommendation" required>
            {(f) => (
              <Select value={recommendation} onValueChange={setRecommendation}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_OUTCOMES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Comments">
            {(f) => <Textarea {...f} rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy}>
              Submit evaluation
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
