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
import { classService } from "@/services/classService";
import type { ClassRecord } from "@/types/class";
import { toCsv, downloadCsv } from "@/lib/csv";

interface DefaulterRow {
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
  className: string;
  sectionName: string | null;
  present: number;
  absent: number;
  total: number;
  pct: number;
  tier: "critical" | "warning";
}

interface DefaultersData {
  from: string;
  to: string;
  warningThreshold: number;
  criticalThreshold: number;
  rows: DefaulterRow[];
}

const ALL_CLASSES = "all";

export function AttendanceDefaulters() {
  const [classes, setClasses] = useState<ClassRecord[] | null>(null);
  const [classId, setClassId] = useState(ALL_CLASSES);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<DefaultersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    classService.list({ pageSize: 200, status: "active" }).then((r) => setClasses(r.data)).catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cancelled) return;
      setLoading(true);
      setError(false);
      const query = new URLSearchParams();
      if (classId !== ALL_CLASSES) query.set("classId", classId);
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      try {
        const res = await fetch(`/api/attendance/defaulters?${query.toString()}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error);
        setData(body);
        if (!from) setFrom(body.from);
        if (!to) setTo(body.to);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [classId, from, to]);

  function handleExport() {
    if (!data) return;
    const csv = toCsv(data.rows, [
      { header: "Roll No", value: (r) => r.rollNumber },
      { header: "Student", value: (r) => `${r.firstName} ${r.lastName}` },
      { header: "Class", value: (r) => r.className },
      { header: "Section", value: (r) => r.sectionName },
      { header: "Present", value: (r) => r.present },
      { header: "Total", value: (r) => r.total },
      { header: "Attendance %", value: (r) => r.pct },
      { header: "Tier", value: (r) => r.tier },
    ]);
    downloadCsv(`attendance-defaulters-${data.from}-to-${data.to}.csv`, csv);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <FormField label="Class">
            {(f) => (
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder={classes ? "All classes" : "Loading…"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CLASSES}>All classes</SelectItem>
                  {(classes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="From">{(f) => <Input id={f.id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</FormField>
          <FormField label="To">
            {(f) => <Input id={f.id} type="date" value={to} onChange={(e) => setTo(e.target.value)} max={new Date().toISOString().slice(0, 10)} />}
          </FormField>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState onRetry={() => setError(false)} />
      ) : loading || !data ? (
        <LoadingState className="py-16" />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Below {data.warningThreshold}% ·{" "}
                <Badge variant="danger" className="align-middle">
                  Critical
                </Badge>{" "}
                under {data.criticalThreshold}%
              </p>
              <Button variant="secondary" size="sm" onClick={handleExport} disabled={data.rows.length === 0}>
                <Download className="size-4" /> Export CSV
              </Button>
            </div>

            {data.rows.length === 0 ? (
              <EmptyState title="No defaulters" description="Every active student is at or above the warning threshold for this range." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Present / Total</TableHead>
                    <TableHead>%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="text-muted-foreground">{row.rollNumber ?? "—"}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        {row.firstName} {row.lastName}
                      </TableCell>
                      <TableCell>
                        {row.className}
                        {row.sectionName ? ` - ${row.sectionName}` : ""}
                      </TableCell>
                      <TableCell>
                        {row.present} / {row.total}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.tier === "critical" ? "danger" : "warning"}>{row.pct}%</Badge>
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
