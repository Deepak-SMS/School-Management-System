"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Lock, LockOpen } from "lucide-react";
import { hrAttendanceService, type AttendanceSummary, type DaySheet } from "@/services/hrAttendanceService";
import type { ApiError } from "@/services/studentService";
import {
  MARKABLE_ATTENDANCE_STATUSES,
  STAFF_ATTENDANCE_LABELS,
  STAFF_ATTENDANCE_TONES,
  type StaffAttendanceStatus,
} from "@/lib/constants/hr-attendance";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { toast } from "@/hooks/use-toast";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceSheet() {
  const can = useCan();
  const canMark = can("employeeAttendance", "edit");
  const canLock = can("employeeAttendance", "approve");
  const canReopen = can("employeeAttendance", "delete");

  const [date, setDate] = useState(today());
  const [sheet, setSheet] = useState<DaySheet | null>(null);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** staffId → status chosen but not yet saved. */
  const [draft, setDraft] = useState<Record<string, string>>({});

  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  function loadSheet() {
    hrAttendanceService
      .daySheet({ date })
      .then((s) => {
        setSheet(s);
        setDraft({});
        setError(false);
      })
      .catch(() => setError(true));
  }

  function loadSummary() {
    hrAttendanceService
      .summary({ year, month })
      .then(setSummary)
      .catch(() => setSummary(null));
  }

  useEffect(() => {
    loadSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function save() {
    const entries = Object.entries(draft).map(([staffId, status]) => ({ staffId, status }));
    if (entries.length === 0) return;

    setActionError(null);
    setSaving(true);
    try {
      const result = await hrAttendanceService.mark(date, entries);
      toast({ title: `${result.marked} marked`, variant: "success" });
      loadSheet();
      loadSummary();
    } catch (e) {
      setActionError((e as ApiError)?.error ?? "Attendance couldn't be saved.");
    } finally {
      setSaving(false);
    }
  }

  /** Marks every working-day row that has nothing recorded yet. */
  function markRestPresent() {
    if (!sheet) return;
    const next = { ...draft };
    for (const row of sheet.data) {
      if (row.isWorkingDay && !row.attendance && !next[row.staffId]) next[row.staffId] = "present";
    }
    setDraft(next);
  }

  async function setLock(action: "lock" | "reopen", reason?: string) {
    setActionError(null);
    try {
      await hrAttendanceService.setLock({ year, month, action, reason });
      toast({ title: action === "lock" ? "Month locked" : "Month reopened", variant: "success" });
      setReopenOpen(false);
      setReopenReason("");
      loadSummary();
      loadSheet();
    } catch (e) {
      setActionError((e as ApiError)?.error ?? "That didn't work.");
    }
  }

  if (error) return <ErrorState onRetry={loadSheet} />;

  const pendingChanges = Object.keys(draft).length;

  return (
    <div className="flex flex-col gap-6">
      {actionError && (
        <Alert variant="danger" title="Couldn't complete that">
          {actionError}
        </Alert>
      )}

      <Tabs defaultValue="day">
        <TabsList>
          <TabsTrigger value="day">Mark a day</TabsTrigger>
          <TabsTrigger value="month">Monthly summary</TabsTrigger>
        </TabsList>

        <TabsContent value="day">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-44"
                aria-label="Attendance date"
              />
              {canMark && !sheet?.locked && (
                <>
                  <Button variant="secondary" onClick={markRestPresent}>
                    Mark the rest present
                  </Button>
                  <Button onClick={save} isLoading={saving} disabled={pendingChanges === 0}>
                    Save {pendingChanges > 0 ? `${pendingChanges} change${pendingChanges === 1 ? "" : "s"}` : ""}
                  </Button>
                </>
              )}
            </div>

            {sheet?.locked && (
              <Alert variant="warning" title="This month is locked">
                Attendance for this month was closed{sheet.lockedAt ? ` on ${sheet.lockedAt.slice(0, 10)}` : ""}. It
                can&apos;t be changed until an authorised user reopens it.
              </Alert>
            )}

            {!sheet ? (
              <TableSkeleton />
            ) : sheet.data.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No employees" description="Add employees before marking attendance." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheet.data.map((row) => {
                    const current = draft[row.staffId] ?? row.attendance?.status ?? "";
                    // A day the school is closed, or one an approved leave already
                    // covers, is not HR's to type over.
                    const readOnly = !row.isWorkingDay || row.attendance?.source === "leave" || sheet.locked || !canMark;

                    return (
                      <TableRow key={row.staffId}>
                        <TableCell>
                          <p className="font-medium text-foreground">{row.fullName}</p>
                          <p className="text-xs text-muted-foreground">{row.employeeId}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.department ?? "—"}</TableCell>
                        <TableCell>
                          {readOnly ? (
                            <Badge
                              variant={
                                current ? STAFF_ATTENDANCE_TONES[current as StaffAttendanceStatus] : "neutral"
                              }
                            >
                              {current
                                ? (STAFF_ATTENDANCE_LABELS[current as StaffAttendanceStatus] ?? current)
                                : (row.nonWorkingReason ?? "Not a working day")}
                            </Badge>
                          ) : (
                            <Select
                              value={current}
                              onValueChange={(v) => setDraft((d) => ({ ...d, [row.staffId]: v }))}
                            >
                              <SelectTrigger className="w-44" aria-label={`Status for ${row.fullName}`}>
                                <SelectValue placeholder="Not marked" />
                              </SelectTrigger>
                              <SelectContent>
                                {MARKABLE_ATTENDANCE_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {STAFF_ATTENDANCE_LABELS[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.attendance?.source === "leave"
                            ? "From approved leave"
                            : row.attendance
                              ? "Marked"
                              : row.isWorkingDay
                                ? "—"
                                : (row.nonWorkingReason ?? "Closed")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="month">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-40" aria-label="Month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(Date.UTC(2000, m - 1, 1)).toLocaleString("en-IN", { month: "long", timeZone: "UTC" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-28"
                aria-label="Year"
              />

              {summary?.locked
                ? canReopen && (
                    <Button variant="secondary" onClick={() => setReopenOpen(true)}>
                      <LockOpen className="size-4" /> Reopen month
                    </Button>
                  )
                : canLock && (
                    <Button variant="secondary" onClick={() => setLock("lock")} disabled={!summary}>
                      <Lock className="size-4" /> Lock month
                    </Button>
                  )}
            </div>

            {summary && (
              <>
                {summary.locked ? (
                  <Alert variant="success" title="Locked and ready for payroll">
                    These figures are frozen. Payroll can run against them.
                  </Alert>
                ) : summary.readyForPayroll ? (
                  <Alert variant="success" title="Every working day is accounted for">
                    Lock the month to freeze these figures before running payroll.
                  </Alert>
                ) : (
                  <Alert variant="warning" title={`${summary.totals.unmarked} working days still unmarked`}>
                    An unmarked day is not an absence — payroll would have nothing to go on. Mark them before locking.
                  </Alert>
                )}

                {!summary ? null : summary.data.length === 0 ? (
                  <EmptyState icon={CalendarDays} title="No employees" description="Nothing to summarise." />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {new Date(Date.UTC(summary.year, summary.month - 1, 1)).toLocaleString("en-IN", {
                          month: "long",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead className="text-right">Working</TableHead>
                            <TableHead className="text-right">Present</TableHead>
                            <TableHead className="text-right">Half</TableHead>
                            <TableHead className="text-right">Paid leave</TableHead>
                            <TableHead className="text-right">Unpaid</TableHead>
                            <TableHead className="text-right">Absent</TableHead>
                            <TableHead className="text-right">Unmarked</TableHead>
                            <TableHead className="text-right">Payable</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.data.map((r) => (
                            <TableRow key={r.staffId}>
                              <TableCell>
                                <p className="font-medium text-foreground">{r.fullName}</p>
                                <p className="text-xs text-muted-foreground">{r.employeeId}</p>
                              </TableCell>
                              <TableCell className="text-right">{r.workingDays}</TableCell>
                              <TableCell className="text-right">{r.present}</TableCell>
                              <TableCell className="text-right">{r.halfDays}</TableCell>
                              <TableCell className="text-right">{r.paidLeave}</TableCell>
                              <TableCell className="text-right">{r.unpaidLeave}</TableCell>
                              <TableCell className="text-right">{r.absent}</TableCell>
                              <TableCell className="text-right">
                                {r.unmarked > 0 ? <Badge variant="warning">{r.unmarked}</Badge> : "—"}
                              </TableCell>
                              <TableCell className="text-right font-medium">{r.payableDays}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Modal open={reopenOpen} onOpenChange={setReopenOpen}>
        <ModalContent title="Reopen this month?">
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-muted-foreground">
              Payroll may already have run against these figures. Reopening is recorded against your name, with the
              reason.
            </p>
            <Input
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Why is this being reopened?"
              aria-label="Reason"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setReopenOpen(false)}>
                Keep it locked
              </Button>
              <Button onClick={() => setLock("reopen", reopenReason)} disabled={reopenReason.trim().length < 5}>
                Reopen
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
}
