"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { UserCheck, UserX, HelpCircle, Users, ClipboardCheck } from "lucide-react";
import { useCan } from "@/hooks/use-can";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AttendanceTrendChart, type AttendanceTrendPoint } from "@/features/dashboard/attendance-trend-chart";

interface AttendanceOverview {
  today: { present: number; absent: number; notMarked: number; totalActive: number; marked: boolean };
  weekly: AttendanceTrendPoint[];
  byClass: {
    classId: string;
    className: string;
    totalActive: number;
    markedCount: number;
    present: number;
    notMarked: number;
    pct: number | null;
  }[];
}

export function AttendanceDashboard() {
  const can = useCan();
  const canMark = can("studentAttendance", "edit");
  const [data, setData] = useState<AttendanceOverview | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/attendance/dashboard")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setData(body);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error) return <ErrorState className="py-16" onRetry={load} />;
  if (!data) return <LoadingState className="py-16" />;

  return (
    <div className="flex flex-col gap-6">
      {canMark && (
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/academics/attendance/mark">
              <ClipboardCheck className="size-4" /> Mark Attendance
            </Link>
          </Button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={UserCheck}
          label="Present today"
          value={data.today.marked ? data.today.present : "—"}
          tone="success"
        />
        <StatCard
          icon={UserX}
          label="Absent today"
          value={data.today.marked ? data.today.absent : "—"}
          tone="danger"
        />
        <StatCard icon={HelpCircle} label="Not marked yet" value={data.today.notMarked} tone="warning" />
        <StatCard icon={Users} label="Active students" value={data.today.totalActive} tone="neutral" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Attendance this week</CardTitle>
          <CardDescription>Present vs absent, last 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.weekly.every((d) => d.present === 0 && d.absent === 0) ? (
            <EmptyState icon={ClipboardCheck} title="No attendance recorded this week" />
          ) : (
            <AttendanceTrendChart data={data.weekly} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Class-wise attendance today</CardTitle>
          <CardDescription>Every active class — including the ones nobody has marked yet.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.byClass.length === 0 ? (
            <EmptyState title="No classes yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Active students</TableHead>
                  <TableHead>Marked</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Attendance %</TableHead>
                  {canMark && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byClass.map((row) => (
                  <TableRow key={row.classId}>
                    <TableCell className="font-medium text-foreground">{row.className}</TableCell>
                    <TableCell>{row.totalActive}</TableCell>
                    <TableCell>{row.markedCount}</TableCell>
                    <TableCell>{row.present}</TableCell>
                    <TableCell>
                      {row.pct === null ? (
                        <Badge variant="neutral">Not marked</Badge>
                      ) : (
                        <Badge variant={row.pct >= 90 ? "success" : row.pct >= 75 ? "warning" : "danger"}>{row.pct}%</Badge>
                      )}
                    </TableCell>
                    {canMark && (
                      <TableCell className="text-right">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/academics/attendance/mark?classId=${row.classId}`}>
                            {row.pct === null ? "Mark now" : "Review"}
                          </Link>
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
