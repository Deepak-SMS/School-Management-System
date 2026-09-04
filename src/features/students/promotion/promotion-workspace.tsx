"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GraduationCap, ArrowRight, RefreshCw } from "lucide-react";
import { academicYearService } from "@/services/academicYearService";
import { promotionService, type PromotionPreviewResponse } from "@/services/promotionService";
import type { AcademicYearRecord } from "@/types/academicYear";
import type { PromotionAction } from "@/lib/validation/promotion";
import { suggestTargetClass, suggestSameLevelClass } from "@/lib/students/promotion";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { PromotionClassRow, type ClassOutcome } from "@/features/students/promotion/promotion-class-row";

export function PromotionWorkspace() {
  const [years, setYears] = useState<AcademicYearRecord[] | null>(null);
  const [yearsError, setYearsError] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");

  const [preview, setPreview] = useState<PromotionPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [mappings, setMappings] = useState<Record<string, ClassOutcome>>({});
  const [overrides, setOverrides] = useState<Record<string, PromotionAction>>({});
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const loadYears = useCallback(() => {
    let cancelled = false;
    academicYearService
      .list({ pageSize: 50 })
      .then((res) => {
        if (cancelled) return;
        setYears(res.data);
        setYearsError(false);
        const active = res.data.find((y) => y.status === "active");
        const other = res.data.find((y) => y.id !== active?.id);
        if (active) setSourceId((v) => v || active.id);
        if (other) setTargetId((v) => v || other.id);
      })
      .catch(() => {
        if (!cancelled) setYearsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadYears(), [loadYears]);

  const validSelection = Boolean(sourceId && targetId && sourceId !== targetId);

  const loadPreview = useCallback(() => {
    if (!sourceId || !targetId || sourceId === targetId) return undefined;
    let cancelled = false;
    promotionService
      .preview(sourceId, targetId)
      .then((res) => {
        if (cancelled) return;
        setPreview(res);
        setPreviewError(null);
        setMappings(
          Object.fromEntries(
            res.classes.map((c) => [c.id, { action: c.suggestedAction, targetClassId: c.suggestedTargetClassId ?? undefined }]),
          ),
        );
        setOverrides({});
        setExpandedClassId(null);
      })
      .catch((e) => {
        if (!cancelled) setPreviewError(e?.error ?? "Couldn't load the promotion preview.");
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId, targetId]);

  useEffect(() => loadPreview(), [loadPreview]);

  /** Per-class default target for each action, so switching Promote ↔ Retain re-defaults sensibly. */
  const classSuggestions = useMemo(() => {
    if (!preview) return {};
    return Object.fromEntries(
      preview.classes.map((c) => [
        c.id,
        {
          promote: suggestTargetClass(c, preview.targetClasses)?.id,
          retain: suggestSameLevelClass(c, preview.targetClasses)?.id,
        },
      ]),
    );
  }, [preview]);

  const summary = useMemo(() => {
    const counts = { promote: 0, retain: 0, exit: 0, unresolvedClasses: 0 };
    if (!preview) return counts;
    for (const cls of preview.classes) {
      const outcome = mappings[cls.id];
      if (outcome && outcome.action !== "exit" && !outcome.targetClassId) counts.unresolvedClasses += 1;
      for (const student of cls.students) {
        const action = overrides[student.id] ?? outcome?.action ?? "exit";
        counts[action] += 1;
      }
    }
    return counts;
  }, [preview, mappings, overrides]);

  async function handleCommit() {
    if (!preview) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const result = await promotionService.commit({
        sourceAcademicYearId: sourceId,
        targetAcademicYearId: targetId,
        classMappings: preview.classes.map((c) => ({ sourceClassId: c.id, ...mappings[c.id] })),
        studentOverrides: Object.entries(overrides).map(([studentId, action]) => ({ studentId, action })),
      });
      toast({
        title: "Students promoted",
        description: `${result.promoted} promoted · ${result.retained} retained · ${result.exited} graduated`,
        variant: "success",
      });
      setConfirmOpen(false);
      loadPreview();
    } catch (e) {
      const message = (e as { error?: string })?.error ?? "Couldn't complete the promotion.";
      setCommitError(message);
    } finally {
      setCommitting(false);
    }
  }

  if (yearsError) return <ErrorState onRetry={loadYears} />;
  if (!years) return <LoadingState />;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Choose academic years</CardTitle>
          <CardDescription>Move students from the source year&apos;s classes into the target year&apos;s.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <FormField label="From (source year)">
            {(field) => (
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger id={field.id}>
                  <SelectValue placeholder="Select a year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.label} {y.status === "active" && "· active"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <div className="hidden items-end justify-center pb-2 sm:flex">
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <FormField label="To (target year)">
            {(field) => (
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger id={field.id}>
                  <SelectValue placeholder="Select a year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y.id} value={y.id} disabled={y.id === sourceId}>
                      {y.label} {y.status === "active" && "· active"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        </CardContent>
      </Card>

      {!validSelection && (
        <p className="text-sm text-muted-foreground">Pick two different academic years to see classes to promote.</p>
      )}

      {validSelection && !preview && !previewError && <LoadingState label="Loading classes…" />}
      {validSelection && previewError && <ErrorState description={previewError} onRetry={loadPreview} />}

      {validSelection && !previewError && preview && preview.classes.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="No students to promote"
          description="The source year has no active students in any class."
        />
      )}

      {validSelection && !previewError && preview && preview.classes.length > 0 && preview.targetClasses.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="The target year has no classes yet"
          description={`${preview.targetYear.label} needs its class structure before students can move into it — copy it from a previous year when creating it, or add classes manually under School Management → Classes.`}
        />
      )}

      {validSelection && !previewError && preview && preview.classes.length > 0 && preview.targetClasses.length > 0 && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>
                  {preview.sourceYear.label} <ArrowRight className="inline size-3.5" /> {preview.targetYear.label}
                </CardTitle>
                <CardDescription>Expand a class to override individual students.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={loadPreview}>
                <RefreshCw className="size-4" /> Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table wrapperClassName="rounded-none border-none">
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target class</TableHead>
                    <TableHead>Target section</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.classes.map((cls) => (
                    <PromotionClassRow
                      key={cls.id}
                      cls={cls}
                      outcome={mappings[cls.id] ?? { action: "exit" }}
                      onChange={(outcome) => setMappings((m) => ({ ...m, [cls.id]: outcome }))}
                      targetClasses={preview.targetClasses}
                      expanded={expandedClassId === cls.id}
                      onToggleExpand={() => setExpandedClassId((id) => (id === cls.id ? null : cls.id))}
                      studentOverrides={overrides}
                      onStudentOverrideChange={(studentId, action) =>
                        setOverrides((o) => {
                          if (action === null) {
                            return Object.fromEntries(Object.entries(o).filter(([id]) => id !== studentId));
                          }
                          return { ...o, [studentId]: action };
                        })
                      }
                      suggestions={classSuggestions[cls.id] ?? {}}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="success">{summary.promote} promoted</Badge>
                <Badge variant="info">{summary.retain} retained</Badge>
                <Badge variant="neutral">{summary.exit} graduating / exiting</Badge>
                {summary.unresolvedClasses > 0 && <Badge variant="danger">{summary.unresolvedClasses} classes need a target</Badge>}
              </div>
              <Button onClick={() => setConfirmOpen(true)} disabled={summary.unresolvedClasses > 0}>
                Promote students
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setCommitError(null);
        }}
        title={`Promote into ${preview?.targetYear.label ?? "the target year"}?`}
        description={
          commitError ??
          `${summary.promote} students will be promoted, ${summary.retain} retained, and ${summary.exit} marked as graduated/exited. This updates their records immediately.`
        }
        confirmLabel="Promote students"
        variant={commitError ? "destructive" : "primary"}
        isLoading={committing}
        onConfirm={handleCommit}
      />
    </div>
  );
}
