"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, UserCheck, UserX, TriangleAlert } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ClassSectionPicker } from "@/features/ai/shared/class-section-picker";
import { AiNarrativeCard } from "@/features/ai/shared/ai-narrative-card";
import { aiAnalyticsService } from "@/services/aiAnalyticsService";
import type { AiAttendanceAnalyticsResponse } from "@/types/ai-analytics";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function AttendanceAnalyticsView() {
  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();
  const [threshold, setThreshold] = useState(75);
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => isoDate(new Date()));

  const [data, setData] = useState<AiAttendanceAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // No synchronous setState at the top here on purpose: only the initial
  // `loading` state (true) shows the first skeleton. A refetch triggered by
  // changing a filter swaps `data` in place once it resolves, rather than
  // flashing the loading state again on every filter tweak.
  function load() {
    aiAnalyticsService
      .fetch({ section: "attendance", classId, sectionId, from, to, thresholdPct: threshold })
      .then((res) => {
        setData(res as AiAttendanceAnalyticsResponse);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sectionId, threshold, from, to]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <ClassSectionPicker classId={classId} sectionId={sectionId} onClassChange={setClassId} onSectionChange={setSectionId} />
        <div className="flex flex-col gap-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Below % threshold</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(1, Math.min(100, Number(e.target.value) || 75)))}
            className="w-28"
          />
        </div>
      </div>

      {error ? (
        <ErrorState onRetry={load} />
      ) : loading && !data ? (
        <LoadingState label="Loading attendance analytics…" />
      ) : data ? (
        <>
          <AiNarrativeCard loading={loading} narrative={data.narrative} narrativeError={data.narrativeError} />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Attendance rate" value={`${data.stats.attendancePct}%`} icon={Users} tone={data.stats.attendancePct < 75 ? "warning" : "primary"} />
            <StatCard label="Present" value={data.stats.present} icon={UserCheck} />
            <StatCard label="Absent" value={data.stats.absent} icon={UserX} tone="warning" />
            <StatCard label={`Below ${threshold}%`} value={data.lowAttendanceStudents.length} icon={TriangleAlert} tone={data.lowAttendanceStudents.length > 0 ? "danger" : "primary"} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daily trend</CardTitle>
            </CardHeader>
            <CardContent>
              {data.stats.dailyTrend.length === 0 ? (
                <EmptyState title="No attendance recorded in this range" className="py-10" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.stats.dailyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                        axisLine={{ stroke: "var(--color-border)" }}
                        tickLine={false}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: "var(--color-border)", opacity: 0.3 }}
                        contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="present" name="Present" fill="var(--color-accent-500)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="absent" name="Absent" fill="var(--color-danger-500)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Students below {threshold}% attendance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.lowAttendanceStudents.length === 0 ? (
                <EmptyState icon={UserCheck} title="No students below the threshold" className="py-10" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Present / Total</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lowAttendanceStudents.map((s) => (
                      <TableRow key={s.studentId}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.className}</TableCell>
                        <TableCell>{s.sectionName ?? "—"}</TableCell>
                        <TableCell>
                          {s.presentDays} / {s.totalDays}
                        </TableCell>
                        <TableCell className="text-right font-medium text-danger-600">{s.pct}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
