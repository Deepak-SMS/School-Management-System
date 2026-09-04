"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants/attendance";
import { useClassSectionPicker, DAILY_VALUE } from "@/features/attendance/use-class-section-picker";
import { useAllowedStatuses } from "@/features/attendance/use-allowed-statuses";
import { toCsv, downloadCsv } from "@/lib/csv";

interface ReportRow {
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
  byStatus: Record<string, number>;
  present: number;
  absent: number;
  total: number;
  pct: number | null;
}

interface ReportData {
  class: { id: string; name: string };
  section: { id: string; name: string };
  subject: { id: string; name: string } | null;
  from: string;
  to: string;
  daysMarked: number;
  summary: { studentCount: number; avgPct: number | null };
  rows: ReportRow[];
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceReports() {
  const allowedStatuses = useAllowedStatuses();
  const { classes, classId, setClassId, sections, sectionId, setSectionId, subjects, subjectId, setSubjectId } =
    useClassSectionPicker();
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!classId || !sectionId || !from || !to) return;
    let cancelled = false;
    async function loadReport() {
      if (cancelled) return;
      setLoading(true);
      setError(false);
      const query = new URLSearchParams({
        classId,
        sectionId,
        from,
        to,
        ...(subjectId !== DAILY_VALUE && { subjectId }),
      });
      try {
        const res = await fetch(`/api/attendance/reports?${query.toString()}`);
        const body = await res.json();
        if (cancelled) return;
        setReport(body);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      }
    }
    loadReport();
    return () => {
      cancelled = true;
    };
  }, [classId, sectionId, subjectId, from, to]);

  function handleExport() {
    if (!report) return;
    const csv = toCsv(report.rows, [
      { header: "Roll No", value: (r) => r.rollNumber },
      { header: "Student", value: (r) => `${r.firstName} ${r.lastName}` },
      ...allowedStatuses.map((status) => ({
        header: ATTENDANCE_STATUS_LABELS[status],
        value: (r: ReportRow) => r.byStatus[status] ?? 0,
      })),
      { header: "Total", value: (r) => r.total },
      { header: "Attendance %", value: (r) => (r.pct === null ? "" : r.pct) },
    ]);
    downloadCsv(`attendance-${report.class.name}-${report.section.name}-${report.from}-to-${report.to}.csv`, csv);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <FormField label="Class" required>
            {(f) => (
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder={classes ? "Select class" : "Loading…"} />
                </SelectTrigger>
                <SelectContent>
                  {(classes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Section" required>
            {(f) => (
              <Select value={sectionId} onValueChange={setSectionId} disabled={!classId || sections.length === 0}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder={classId ? "Select section" : "Select a class first"} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Subject" description="Daily = homeroom">
            {(f) => (
              <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DAILY_VALUE}>Daily (homeroom)</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="From">{(f) => <Input id={f.id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</FormField>
          <FormField label="To">{(f) => <Input id={f.id} type="date" value={to} onChange={(e) => setTo(e.target.value)} max={defaultTo()} />}</FormField>
        </CardContent>
      </Card>

      {!classId || !sectionId ? (
        <EmptyState title="Pick a class and section" description="Choose a class and section above to generate a report." />
      ) : error ? (
        <ErrorState onRetry={() => setError(false)} />
      ) : loading || !report ? (
        <LoadingState className="py-16" />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">
                  {report.class.name} - {report.section.name}
                  {report.subject ? ` · ${report.subject.name}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {report.daysMarked} day{report.daysMarked === 1 ? "" : "s"} marked · Class average{" "}
                  {report.summary.avgPct === null ? "—" : `${report.summary.avgPct}%`}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleExport} disabled={report.rows.length === 0}>
                <Download className="size-4" /> Export CSV
              </Button>
            </div>

            {report.rows.length === 0 ? (
              <EmptyState title="No students in this class/section." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll</TableHead>
                    <TableHead>Student</TableHead>
                    {allowedStatuses.map((status) => (
                      <TableHead key={status}>{ATTENDANCE_STATUS_LABELS[status]}</TableHead>
                    ))}
                    <TableHead>Total</TableHead>
                    <TableHead>%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="text-muted-foreground">{row.rollNumber ?? "—"}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        {row.firstName} {row.lastName}
                      </TableCell>
                      {allowedStatuses.map((status) => (
                        <TableCell key={status}>{row.byStatus[status] ?? 0}</TableCell>
                      ))}
                      <TableCell>{row.total}</TableCell>
                      <TableCell>
                        {row.pct === null ? (
                          <Badge variant="neutral">—</Badge>
                        ) : (
                          <Badge variant={row.pct >= 90 ? "success" : row.pct >= 75 ? "warning" : "danger"}>{row.pct}%</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
