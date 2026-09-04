"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Briefcase,
  ClipboardCheck,
  Wallet,
  UserPlus,
  Bus,
  BookOpen,
  Award,
  Newspaper,
  CalendarDays,
  AlertTriangle,
  Info,
  XCircle,
  Plus,
  Sparkles,
  History,
  ListChecks,
  CalendarClock,
  Clock,
} from "lucide-react";
import { useCan } from "@/hooks/use-can";
import { useCurrentUser } from "@/providers/user-provider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { AttendanceTrendChart, type AttendanceTrendPoint } from "@/features/dashboard/attendance-trend-chart";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

interface DashboardData {
  school: { name: string };
  academicYearLabel: string | null;
  greetingName: string;
  students: { total: number; active: number; boys: number; girls: number; newAdmissions: number } | null;
  staff: { total: number; teaching: number; nonTeaching: number; active: number; onLeave: number } | null;
  attendance: {
    today: { present: number; absent: number; notMarked: number; totalActive: number; marked: boolean };
    weekly: AttendanceTrendPoint[];
    byClass: { classId: string; className: string; totalActive: number; markedCount: number; present: number; notMarked: number; pct: number | null }[];
  } | null;
  fees: {
    charged: number;
    paid: number;
    pending: number;
    overdue: number;
    collectedToday: number;
    collectedThisMonth: number;
    defaulterCount: number;
  } | null;
  admissions: {
    enquiries: { total: number; new: number; contacted: number; interested: number; converted: number };
    registrations: { total: number; pending: number; approved: number; rejected: number };
    funnel: { label: string; count: number }[];
  } | null;
  transport: {
    total: number;
    active: number;
    maintenance: number;
    inactive: number;
    routesActive: number;
    studentsEnrolled: number;
  } | null;
  library: { totalTitles: number; totalCategories: number; totalBooks: number; available: number; issued: number } | null;
  certificates: { generatedThisMonth: number; totalActive: number } | null;
  news: { published: number; draft: number };
  holidays: { id: string; name: string; startDate: string; endDate: string }[] | null;
  alerts: { id: string; severity: "info" | "warning" | "danger"; message: string; href: string }[];
  recentActivity: { id: string; when: string; actor: string; action: string; entityType: string | null }[] | null;
  unavailable: string[];
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Ticks every second so the seconds digit visibly moves. Starts `null` and
 * only sets a real Date from an effect, so the server-rendered HTML and the
 * client's first render always match (a locale-formatted `new Date()`
 * computed during render would differ between the server's clock and the
 * browser's, and mismatch on hydration).
 */
function useLiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => setNow(new Date()), 0);
    const interval = setInterval(() => setNow(new Date()), 1_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);
  return now;
}

interface QuickAction {
  label: string;
  href: string;
  module?: PermissionModule;
  action?: PermissionAction;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add student", href: "/students/new", module: "students", action: "create" },
  { label: "Add staff", href: "/employees/new", module: "employees", action: "create" },
  { label: "New enquiry", href: "/admissions/enquiries", module: "admissionEnquiries", action: "create" },
  { label: "Record payment", href: "/fees/payments/new", module: "payments", action: "create" },
  { label: "Add vehicle", href: "/transport/vehicles/new", module: "transportVehicles", action: "create" },
  { label: "Add book", href: "/library/catalogue/new", module: "libraryCatalogue", action: "create" },
  { label: "Generate certificate", href: "/certificates/generate", module: "certificates", action: "create" },
  { label: "Add news", href: "/news/new" },
];

export function DashboardOverview() {
  const can = useCan();
  const user = useCurrentUser();
  const now = useLiveClock();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body as DashboardData;
      })
      .then((body) => {
        if (cancelled) return;
        setData(body);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.error ?? "Couldn't load the dashboard.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading dashboard…" />;

  const attendancePct =
    data.attendance && data.attendance.today.totalActive > 0
      ? Math.round((data.attendance.today.present / data.attendance.today.totalActive) * 100)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {timeGreeting()}, {data.greetingName} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.school.name}
            {data.academicYearLabel ? ` · ${data.academicYearLabel}` : ""} · Signed in as {user.roleLabel}
          </p>
        </div>
        {now && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground">
            <Clock className="size-4" aria-hidden="true" />
            {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ·{" "}
            <span className="tabular-nums">
              {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.filter((a) => !a.module || can(a.module, a.action!)).map((a) => (
          <Button key={a.href + a.label} asChild variant="secondary" size="sm">
            <Link href={a.href}>
              <Plus className="size-4" /> {a.label}
            </Link>
          </Button>
        ))}
      </div>

      {data.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <ListChecks className="size-4 text-muted-foreground" aria-hidden="true" /> Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {data.alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                className="flex items-start gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                {alert.severity === "danger" && (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-danger-600" aria-hidden="true" />
                )}
                {alert.severity === "warning" && (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-600" aria-hidden="true" />
                )}
                {alert.severity === "info" && <Info className="mt-0.5 size-4 shrink-0 text-info-600" aria-hidden="true" />}
                <span className="text-foreground">{alert.message}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.students && (
          <StatCard
            icon={Users}
            label="Students"
            value={data.students.total}
            tone="primary"
            description={`Boys ${data.students.boys} · Girls ${data.students.girls} · New (30d) ${data.students.newAdmissions}`}
          />
        )}
        {data.staff && (
          <StatCard
            icon={Briefcase}
            label="Staff"
            value={data.staff.total}
            tone="neutral"
            description={`Teaching ${data.staff.teaching} · Non-teaching ${data.staff.nonTeaching} · On leave ${data.staff.onLeave}`}
          />
        )}
        {data.attendance && (
          <StatCard
            icon={ClipboardCheck}
            label="Today's attendance"
            value={data.attendance.today.marked ? `${attendancePct}%` : "Not marked yet"}
            tone={!data.attendance.today.marked ? "neutral" : attendancePct! >= 90 ? "success" : attendancePct! >= 75 ? "warning" : "danger"}
            description={
              data.attendance.today.marked
                ? `Present ${data.attendance.today.present} · Absent ${data.attendance.today.absent} · Not marked ${data.attendance.today.notMarked}`
                : "No attendance recorded for today yet."
            }
          />
        )}
        {data.fees && (
          <StatCard
            icon={Wallet}
            label="Fee collection today"
            value={inr(data.fees.collectedToday)}
            tone="success"
            description={`This month ${inr(data.fees.collectedThisMonth)} · Overdue ${data.fees.defaulterCount} students`}
          />
        )}
        {data.admissions && (
          <StatCard
            icon={UserPlus}
            label="Admission applications"
            value={data.admissions.registrations.total}
            tone="primary"
            description={`Pending ${data.admissions.registrations.pending} · Approved ${data.admissions.registrations.approved}`}
          />
        )}
        {data.transport && (
          <StatCard
            icon={Bus}
            label="Transport fleet"
            value={data.transport.total}
            tone="neutral"
            description={`Active ${data.transport.active} · Routes ${data.transport.routesActive} · Students ${data.transport.studentsEnrolled}`}
          />
        )}
      </section>

      {data.attendance && (
        <section aria-label="Attendance analytics" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Attendance this week</CardTitle>
              <CardDescription>Present vs absent, last 7 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.attendance.weekly.every((d) => d.present === 0 && d.absent === 0) ? (
                <EmptyState icon={ClipboardCheck} title="No attendance recorded this week" />
              ) : (
                <AttendanceTrendChart data={data.attendance.weekly} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Class-wise attendance today</CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceByClass rows={data.attendance.byClass} />
            </CardContent>
          </Card>
        </section>
      )}

      {data.fees && (
        <section aria-label="Fee collection" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Fee collection</CardTitle>
              <CardDescription>This academic year.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <MiniStat label="Charged" value={inr(data.fees.charged)} />
              <MiniStat label="Collected" value={inr(data.fees.paid)} />
              <MiniStat label="Pending" value={inr(data.fees.pending)} />
              <MiniStat label="Overdue" value={inr(data.fees.overdue)} tone="danger" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Collection breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ProportionBars
                total={data.fees.charged}
                rows={[
                  { label: "Collected", value: data.fees.paid },
                  { label: "Pending (not yet due)", value: Math.max(0, data.fees.pending - data.fees.overdue) },
                  { label: "Overdue", value: data.fees.overdue },
                ]}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {data.admissions && (
        <Card>
          <CardHeader>
            <CardTitle>Admissions funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelBars stages={data.admissions.funnel} />
          </CardContent>
        </Card>
      )}

      {(data.library || data.certificates || data.news) && (
        <section aria-label="Other modules" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.library && (
            <StatCard
              icon={BookOpen}
              label="Library"
              value={`${data.library.totalTitles} titles`}
              tone="neutral"
              description={`${data.library.totalBooks} copies · Issued ${data.library.issued} · Available ${data.library.available}`}
            />
          )}
          {data.certificates && (
            <StatCard
              icon={Award}
              label="Certificates"
              value={data.certificates.generatedThisMonth}
              tone="neutral"
              description={`Generated this month · ${data.certificates.totalActive} active overall`}
            />
          )}
          <StatCard
            icon={Newspaper}
            label="News & announcements"
            value={data.news.published}
            tone="neutral"
            description={`Published · ${data.news.draft} drafts`}
          />
        </section>
      )}

      <section aria-label="Upcoming and recent activity" className="grid gap-4 lg:grid-cols-2">
        {data.holidays && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" /> Upcoming (next 30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No holidays in the next 30 days.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.holidays.map((h) => (
                    <li key={h.id} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-foreground">{h.name}</span>
                      <span className="shrink-0 text-muted-foreground">{formatHolidayDate(h.startDate, h.endDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {data.recentActivity && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <History className="size-4 text-muted-foreground" aria-hidden="true" /> Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {data.recentActivity.map((item) => (
                    <li key={item.id} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-foreground">
                        {item.actor} — {item.action}
                        {item.entityType && <span className="text-muted-foreground"> ({item.entityType})</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(item.when)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" /> Coming with later phases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={CalendarClock}
            title="Exams, timetable, AI insights, live GPS tracking and the SMS/WhatsApp/email log aren't available yet"
            description="These panels stay empty on purpose rather than showing sample numbers — they fill in automatically once those modules are built."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", tone === "danger" ? "text-danger-600" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

/** Bars sized by each row's share of `total` — for parts of a whole (e.g. collected/pending/overdue of total charged). */
function ProportionBars({ total, rows }: { total: number; rows: { label: string; value: number }[] }) {
  if (total <= 0) return <p className="text-sm text-muted-foreground">No fee charges recorded yet.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const pct = Math.round((row.value / total) * 100);
        return (
          <li key={row.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-foreground">{row.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {inr(row.value)} · {pct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Bars sized relative to the first (widest) stage — for a sequential funnel, not a share of one total. */
function FunnelBars({ stages }: { stages: { label: string; count: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <ul className="flex flex-col gap-1.5">
      {stages.map((stage) => {
        const pct = Math.round((stage.count / max) * 100);
        return (
          <li key={stage.label} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 text-muted-foreground">{stage.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-black/5 dark:bg-white/10">
              <div className="h-full rounded bg-accent-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right tabular-nums text-foreground">{stage.count}</span>
          </li>
        );
      })}
    </ul>
  );
}

function AttendanceByClass({ rows }: { rows: { classId: string; className: string; pct: number | null }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No attendance recorded for today yet.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.classId} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-foreground">{row.className}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {row.pct === null ? "Not marked" : `${row.pct}%`} {row.pct !== null && row.pct < 90 && <Badge variant="warning">⚠</Badge>}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className={cn("h-full rounded-full", row.pct === null ? "bg-transparent" : row.pct < 75 ? "bg-danger-500" : row.pct < 90 ? "bg-warning-500" : "bg-accent-500")}
              style={{ width: `${row.pct ?? 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatHolidayDate(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sStr = s.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (s.toDateString() === e.toDateString()) return sStr;
  const eStr = e.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${sStr} – ${eStr}`;
}
