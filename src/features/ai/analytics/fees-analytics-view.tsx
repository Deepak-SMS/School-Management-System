"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IndianRupee, Wallet, TriangleAlert, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ClassSectionPicker } from "@/features/ai/shared/class-section-picker";
import { AiNarrativeCard } from "@/features/ai/shared/ai-narrative-card";
import { aiAnalyticsService } from "@/services/aiAnalyticsService";
import type { AiFeesAnalyticsResponse } from "@/types/ai-analytics";

function money(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function FeesAnalyticsView() {
  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();

  const [data, setData] = useState<AiFeesAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // No synchronous setState at the top here on purpose — see the matching
  // comment in attendance-analytics-view.tsx.
  function load() {
    aiAnalyticsService
      .fetch({ section: "fees", classId, sectionId })
      .then((res) => {
        setData(res as AiFeesAnalyticsResponse);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sectionId]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <ClassSectionPicker classId={classId} sectionId={sectionId} onClassChange={setClassId} onSectionChange={setSectionId} />
      </div>

      {error ? (
        <ErrorState onRetry={load} />
      ) : loading && !data ? (
        <LoadingState label="Loading fee analytics…" />
      ) : data ? (
        <>
          <AiNarrativeCard loading={loading} narrative={data.narrative} narrativeError={data.narrativeError} />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Collection rate" value={`${data.stats.collectionPct}%`} icon={TrendingUp} />
            <StatCard label="Collected" value={money(data.stats.totalPaid)} icon={Wallet} />
            <StatCard label="Pending" value={money(data.stats.totalPending)} icon={IndianRupee} tone="warning" />
            <StatCard label="Defaulters" value={data.stats.defaulterCount} icon={TriangleAlert} tone={data.stats.defaulterCount > 0 ? "danger" : "primary"} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Collection trend (last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.stats.monthlyTrend.length === 0 ? (
                <EmptyState title="No payments recorded in this range" className="py-10" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.stats.monthlyTrend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                      <Tooltip
                        formatter={(value) => money(Number(value))}
                        contentStyle={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="collected" name="Collected" stroke="var(--color-primary-600)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fee defaulters</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.feeDefaulters.length === 0 ? (
                <EmptyState icon={Wallet} title="No defaulters" description="Every student is current on fees." className="py-10" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Overdue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.feeDefaulters.map((d) => (
                      <TableRow key={d.studentId}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell>{d.className}</TableCell>
                        <TableCell>{d.sectionName ?? "—"}</TableCell>
                        <TableCell className="text-right">{money(d.pending)}</TableCell>
                        <TableCell className="text-right font-medium text-danger-600">{money(d.overdue)}</TableCell>
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
