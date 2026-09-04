"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, GraduationCap, TrendingUp } from "lucide-react";
import {
  admissionReportsService,
  type AdmissionReportsResponse,
} from "@/services/admissionReportsService";
import { schoolStructureService } from "@/services/schoolStructureService";
import type { SchoolStructure } from "@/types/student";
import {
  ENQUIRY_SOURCE_LABELS,
  ENQUIRY_STATUS_LABELS,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_TONE,
  type ApplicationStatus,
} from "@/lib/constants/admissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

/** Bar fill per status tone — same tones the Applications list badges use, so a
 * status reads the same color whether it's a badge or a bar. */
const TONE_BAR_CLASS: Record<string, string> = {
  success: "bg-accent-600",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  info: "bg-info-500",
  primary: "bg-primary-600",
  neutral: "bg-foreground/25",
};

function conversionRate(converted: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((converted / total) * 100)}%`;
}

export function AdmissionReports() {
  const [structure, setStructure] = useState<SchoolStructure | null>(null);
  const [academicYearId, setAcademicYearId] = useState("");
  const [data, setData] = useState<AdmissionReportsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    schoolStructureService
      .get()
      .then((s) => {
        setStructure(s);
        const current = s.academicYears.find((y) => y.isCurrent);
        if (current) setAcademicYearId(current.id);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    setError(false);
    setData(null);
    admissionReportsService
      .get(academicYearId || undefined)
      .then(setData)
      .catch(() => setError(true));
  }, [academicYearId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="w-full max-w-xs">
        <Select value={academicYearId} onValueChange={setAcademicYearId}>
          <SelectTrigger>
            <SelectValue placeholder="Select academic year" />
          </SelectTrigger>
          <SelectContent>
            {(structure?.academicYears ?? []).map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.isCurrent ? `${y.label} (current)` : y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState description="Couldn't load admission reports." onRetry={load} />}
      {!error && !data && <LoadingState label="Loading reports…" />}

      {!error && data && !data.academicYearId && (
        <EmptyState
          icon={BarChart3}
          title="No academic year to report on"
          description="Set up an academic year under School Management before running admission reports."
        />
      )}

      {!error && data && data.academicYearId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Admission funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {data.funnel.every((step) => step.count === 0) ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No activity yet"
                  description="Enquiries and applications logged this year will build the funnel here."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {data.funnel.map((step) => {
                    const max = Math.max(...data.funnel.map((s) => s.count), 1);
                    const pct = Math.max((step.count / max) * 100, step.count > 0 ? 2 : 0);
                    return (
                      <div key={step.label} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-sm text-muted-foreground">{step.label}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                          <div className="h-full rounded-full bg-primary-600" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
                          {step.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Applications by status</CardTitle>
              </CardHeader>
              <CardContent>
                {data.applications.total === 0 ? (
                  <p className="text-sm text-muted-foreground">No applications submitted this year yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.applications.byStatus
                      .filter((row) => row.count > 0)
                      .map((row) => {
                        const tone = APPLICATION_STATUS_TONE[row.status as ApplicationStatus] ?? "neutral";
                        const pct = Math.round((row.count / data.applications.total) * 100);
                        return (
                          <div key={row.status} className="flex items-center gap-3">
                            <span className="w-32 shrink-0 text-sm text-muted-foreground">
                              {APPLICATION_STATUS_LABELS[row.status as ApplicationStatus] ?? row.status}
                            </span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                              <div
                                className={`h-full rounded-full ${TONE_BAR_CLASS[tone]}`}
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                            <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
                              {row.count}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Enquiries by status</CardTitle>
              </CardHeader>
              <CardContent>
                {data.enquiries.total === 0 ? (
                  <p className="text-sm text-muted-foreground">No enquiries logged this year yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.enquiries.byStatus
                          .filter((row) => row.count > 0)
                          .map((row) => (
                            <TableRow key={row.status}>
                              <TableCell>
                                {ENQUIRY_STATUS_LABELS[row.status as keyof typeof ENQUIRY_STATUS_LABELS] ?? row.status}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Enquiries by source</CardTitle>
            </CardHeader>
            <CardContent>
              {data.enquiries.bySource.length === 0 ? (
                <p className="text-sm text-muted-foreground">No enquiries logged this year yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Enquiries</TableHead>
                        <TableHead className="text-right">Converted</TableHead>
                        <TableHead className="text-right">Conversion rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.enquiries.bySource.map((row) => (
                        <TableRow key={row.source}>
                          <TableCell className="font-medium">
                            {ENQUIRY_SOURCE_LABELS[row.source as keyof typeof ENQUIRY_SOURCE_LABELS] ?? row.source}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.converted}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {conversionRate(row.converted, row.count)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {data.enquiries.byCounsellor.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Enquiries by counsellor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Counsellor</TableHead>
                        <TableHead className="text-right">Enquiries</TableHead>
                        <TableHead className="text-right">Converted</TableHead>
                        <TableHead className="text-right">Conversion rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.enquiries.byCounsellor.map((row) => (
                        <TableRow key={row.staffId}>
                          <TableCell className="font-medium">{row.staffName}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.converted}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {conversionRate(row.converted, row.count)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Seats admitted per class</CardTitle>
            </CardHeader>
            <CardContent>
              {data.admittedByClass.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="No admissions yet"
                  description="Approved applications will be counted here by class."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead className="text-right">Students admitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.admittedByClass.map((row) => (
                        <TableRow key={row.classId}>
                          <TableCell className="font-medium">{row.className}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
