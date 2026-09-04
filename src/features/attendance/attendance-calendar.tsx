"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS, PRESENT_STATUSES } from "@/lib/constants/attendance";
import { useClassSectionPicker } from "@/features/attendance/use-class-section-picker";
import { useAllowedStatuses } from "@/features/attendance/use-allowed-statuses";
import { studentService, type StudentAttendanceCalendar } from "@/services/studentService";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  present: "bg-accent-500",
  absent: "bg-danger-500",
  late: "bg-warning-500",
  half_day: "bg-warning-500",
  leave: "bg-black/30 dark:bg-white/40",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface StudentOption {
  id: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null | undefined;
}

interface StudentSearchResult extends StudentOption {
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string | null;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function firstWeekday(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

export function AttendanceCalendar() {
  const allowedStatuses = useAllowedStatuses();
  const { classes, classId, setClassId: setClassIdRaw, sections, sectionId, setSectionId: setSectionIdRaw } = useClassSectionPicker();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [calendar, setCalendar] = useState<StudentAttendanceCalendar | null>(null);
  const [error, setError] = useState(false);

  // A student found via the search box above may belong to a class/section
  // that isn't loaded yet — this holds their id until that section's roster
  // (fetched below) actually contains them, then selects them.
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  function setClassId(id: string) {
    setClassIdRaw(id);
    setStudentId("");
    setStudents([]);
  }

  function setSectionId(id: string) {
    setSectionIdRaw(id);
    setStudentId("");
    setStudents([]);
  }

  useEffect(() => {
    if (!classId || !sectionId) return;
    studentService
      .list({ classId, sectionId, status: "active", pageSize: 100 })
      .then((r) => setStudents(r.data.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, rollNumber: s.rollNumber }))))
      .catch(() => setStudents([]));
  }, [classId, sectionId]);

  // Once the target student's section roster has loaded, select them.
  useEffect(() => {
    if (pendingStudentId && students.some((s) => s.id === pendingStudentId)) {
      setTimeout(() => {
        setStudentId(pendingStudentId);
        setPendingStudentId(null);
      }, 0);
    }
  }, [students, pendingStudentId]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setTimeout(() => setSearchResults([]), 0);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      studentService
        .list({ q: query, status: "active", pageSize: 8 })
        .then((r) => {
          if (cancelled) return;
          setSearchResults(
            r.data.map((s) => ({
              id: s.id,
              firstName: s.firstName,
              lastName: s.lastName,
              rollNumber: s.rollNumber,
              classId: s.class.id,
              sectionId: s.section?.id ?? "",
              className: s.class.name,
              sectionName: s.section?.name ?? null,
            })),
          );
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  function selectSearchResult(result: StudentSearchResult) {
    if (!result.sectionId) return; // no section assigned — nothing to load a roster from
    setClassId(result.classId);
    setSectionId(result.sectionId);
    setPendingStudentId(result.id);
    setSearchQuery(`${result.firstName} ${result.lastName}`);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    async function load() {
      if (cancelled) return;
      setError(false);
      try {
        const data = await studentService.getAttendanceCalendar(studentId, month);
        if (!cancelled) setCalendar(data);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId, month]);

  const dayMap = new Map((calendar?.days ?? []).map((d) => [d.date, d]));
  const total = daysInMonth(month);
  const leading = firstWeekday(month);
  const todayIso = new Date().toISOString().slice(0, 10);

  const markedDays = calendar?.days.length ?? 0;
  const presentDays = calendar?.days.filter((d) => PRESENT_STATUSES.includes(d.status as (typeof PRESENT_STATUSES)[number])).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Input
          leadingIcon={<Search />}
          placeholder="Find a student by name or roll number…"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setSearchOpen(false)}
        />
        {searchOpen && searchQuery.trim().length >= 2 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg">
            {searchResults.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">No students match &quot;{searchQuery.trim()}&quot;.</p>
            ) : (
              searchResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSearchResult(s);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
                >
                  <span className="font-medium text-foreground">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.rollNumber ? `Roll ${s.rollNumber} · ` : ""}
                    {s.className}
                    {s.sectionName ? `-${s.sectionName}` : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
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
          <FormField label="Student" required>
            {(f) => (
              <Select value={studentId} onValueChange={setStudentId} disabled={!sectionId || students.length === 0}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder={sectionId ? "Select student" : "Select a section first"} />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.rollNumber ? `${s.rollNumber} · ` : ""}
                      {s.firstName} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        </CardContent>
      </Card>

      {!studentId ? (
        <EmptyState title="Pick a student" description="Choose a class, section and student above to see their attendance calendar." />
      ) : error ? (
        <ErrorState onRetry={() => setError(false)} />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">
                  <ChevronLeft className="size-4" />
                </Button>
                <p className="w-40 text-center font-medium text-foreground">{monthLabel(month)}</p>
                <Button variant="ghost" size="icon" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {markedDays} day{markedDays === 1 ? "" : "s"} marked · {presentDays} present
              </p>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="py-1 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
              {Array.from({ length: leading }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
                const dateStr = `${month}-${String(day).padStart(2, "0")}`;
                const record = dayMap.get(dateStr);
                const isToday = dateStr === todayIso;
                return (
                  <div
                    key={day}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border border-border py-2",
                      isToday && "border-primary-400 bg-primary-50/40 dark:bg-primary-950/30",
                    )}
                    title={record ? ATTENDANCE_STATUS_LABELS[record.status as (typeof ATTENDANCE_STATUSES)[number]] : "Not marked"}
                  >
                    <span className="text-sm text-foreground">{day}</span>
                    <span className={cn("size-2 rounded-full", record ? STATUS_DOT[record.status] : "bg-transparent")} />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3">
              {allowedStatuses.map((status) => (
                <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
                  {ATTENDANCE_STATUS_LABELS[status]}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
