"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, GraduationCap, XCircle } from "lucide-react";
import {
  studentRegistrationService,
  type AdmissionsOverview as OverviewData,
  type StudentRegistrationRecord,
} from "@/services/studentRegistrationService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

export function AdmissionsOverview() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [approved, setApproved] = useState<StudentRegistrationRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    async function run() {
      setError(false);
      try {
        const [o, a] = await Promise.all([
          studentRegistrationService.overview(),
          studentRegistrationService.list({ status: "approved" }),
        ]);
        setOverview(o);
        setApproved(a.data);
      } catch {
        setError(true);
      }
    }
    run();
  }, [reloadKey]);

  if (error) return <ErrorState description="Couldn't load the admissions overview." onRetry={load} />;
  if (!overview || !approved) return <LoadingState label="Loading admissions overview…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Clock} label="Pending review" value={overview.counts.pending} tone="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value={overview.counts.approved} tone="success" />
        <StatCard icon={XCircle} label="Rejected" value={overview.counts.rejected} tone="danger" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seats admitted per class</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.admittedByClass.length === 0 ? (
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
                  {overview.admittedByClass.map((row) => (
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

      <Card>
        <CardHeader>
          <CardTitle>Approved applications</CardTitle>
        </CardHeader>
        <CardContent>
          {approved.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No approved applications yet"
              description="Applications approved from the Applications page will be listed here, linked to the student created."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Admission no.</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead className="text-right">Student profile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approved.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.studentName}</TableCell>
                      <TableCell>{row.student?.admissionNumber ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.reviewedAt?.slice(0, 10) ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {row.student && (
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/students/${row.student.id}`}>View</a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "success" | "warning" | "danger";
}) {
  const toneClasses = {
    success: "bg-accent-50 text-accent-700",
    warning: "bg-warning-50 text-warning-600",
    danger: "bg-danger-50 text-danger-600",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${toneClasses}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
