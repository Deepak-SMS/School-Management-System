"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants/attendance";
import { useAllowedStatuses } from "@/features/attendance/use-allowed-statuses";
import { academicYearService } from "@/services/academicYearService";
import { toast } from "@/hooks/use-toast";

interface RosterStudent {
  id: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
  admissionNumber: string;
  photoUrl?: string | null;
  gender?: string | null;
  parentMobile?: string | null;
  attendance: { status: string; remarks: string | null } | null;
}

/** The browser/server's local calendar date as "YYYY-MM-DD" — never `toISOString()`, which is UTC and drifts a day off around midnight in most timezones. */
function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The lock-aware roster-marking screen behind both the teacher's "My
 * Classes" page and the admin's "Mark Attendance" page — same
 * `GET /api/my/students` + `POST /api/attendance` round trip either way,
 * since that route already treats a non-teacher caller as free to browse
 * any class/section in the school (see its own `if (user.role === "teacher")`
 * scoping check).
 */
export function RosterView({
  classId,
  sectionId,
  subjectId,
  title,
  /** True for admin-tier viewers (studentAttendance:edit) — they can still write through a lock, which auto-reopens it; a teacher cannot. */
  canBypassLock = false,
  onBack,
}: {
  classId: string;
  sectionId: string;
  subjectId?: string;
  title: string;
  canBypassLock?: boolean;
  onBack: () => void;
}) {
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [students, setStudents] = useState<RosterStudent[] | null>(null);
  const [error, setError] = useState(false);
  const [draftStatus, setDraftStatus] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const allowedStatuses = useAllowedStatuses();
  // Bounds the date picker to the active academic year — attendance can't be
  // marked before it starts, and never for a date beyond today.
  const [minDate, setMinDate] = useState<string | undefined>(undefined);
  const [maxDate, setMaxDate] = useState(today);

  useEffect(() => {
    academicYearService
      .list({ status: "active", pageSize: 1 })
      .then((r) => {
        const activeYear = r.data[0];
        if (!activeYear) return;
        const yearStart = activeYear.startDate.slice(0, 10);
        const yearEnd = activeYear.endDate.slice(0, 10);
        const cappedMax = yearEnd < today ? yearEnd : today;
        setMinDate(yearStart);
        setMaxDate(cappedMax);
        // The default (today) or a date carried over from a previous
        // selection might fall outside a freshly-loaded year's range.
        setDate((current) => (current < yearStart ? yearStart : current > cappedMax ? cappedMax : current));
      })
      .catch(() => undefined);
  }, [today]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadRoster() {
      if (!cancelled) {
        setError(false);
        setStudents(null);
      }
      const query = new URLSearchParams({ classId, sectionId, date, ...(subjectId && { subjectId }) });
      try {
        const res = await fetch(`/api/my/students?${query.toString()}`);
        const body = await res.json();
        if (cancelled) return;
        setStudents(body.data);
        setDraftStatus(Object.fromEntries(body.data.map((s: RosterStudent) => [s.id, s.attendance?.status ?? "present"])));
        setLocked(Boolean(body.locked));
        setLockedAt(body.lockedAt ?? null);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    loadRoster();
    return () => {
      cancelled = true;
    };
  }, [classId, sectionId, subjectId, date, reloadKey]);

  const editable = !locked || canBypassLock;

  function markAllPresent() {
    if (!students) return;
    setDraftStatus(Object.fromEntries(students.map((s) => [s.id, "present"])));
  }

  async function handleSave() {
    if (!students) return;
    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          sectionId,
          subjectId,
          date,
          records: students.map((s) => ({ studentId: s.id, status: draftStatus[s.id] ?? "present" })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast({ title: "Attendance saved", description: `${body.count} students`, variant: "success" });
      reload();
    } catch (e) {
      toast({ title: "Couldn't save attendance", description: e instanceof Error ? e.message : undefined, variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={minDate}
            max={maxDate}
            className="w-40"
          />
          <Button variant="secondary" size="sm" onClick={markAllPresent} disabled={!students || !editable}>
            <CheckCheck className="size-4" /> Mark all present
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={saving} disabled={!students || !editable}>
            Save attendance
          </Button>
        </div>
      </div>

      {locked && (
        <Alert variant="warning" title="Locked">
          Attendance for this date was already submitted{lockedAt ? ` on ${new Date(lockedAt).toLocaleDateString()}` : ""} and is locked.{" "}
          {canBypassLock ? "Saving here will reopen it and record that you edited it directly." : "Ask your school admin to reopen it."}
        </Alert>
      )}

      {error && <ErrorState onRetry={reload} />}
      {!error && !students && <LoadingState label="Loading roster…" />}
      {!error && students && students.length === 0 && <EmptyState title="No students in this class/section." />}

      {!error && students && students.length > 0 && (
        <Card>
          <CardContent className="flex flex-col divide-y divide-border p-0">
            {students.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar initials={`${s.firstName[0]}${s.lastName[0]}`} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Roll {s.rollNumber ?? "—"} · {s.admissionNumber}
                    {s.parentMobile ? ` · ${s.parentMobile}` : ""}
                  </p>
                </div>
                <Select
                  value={draftStatus[s.id] ?? "present"}
                  onValueChange={(v) => setDraftStatus((prev) => ({ ...prev, [s.id]: v }))}
                  disabled={!editable}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {ATTENDANCE_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
