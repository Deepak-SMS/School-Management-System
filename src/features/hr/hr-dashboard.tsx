"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  Briefcase,
  UserCheck,
  UserPlus,
  Clock,
  FileWarning,
  FileClock,
  CalendarDays,
  Cake,
  Award,
  AlertTriangle,
  Info,
  Plus,
  CalendarClock,
} from "lucide-react";
import { useCan } from "@/hooks/use-can";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface DashboardData {
  kpis: Record<string, number>;
  charts: Record<string, { label: string; value: number }[]>;
  upcoming: {
    birthdays: { id: string; fullName: string; date: string | null }[];
    anniversaries: { id: string; fullName: string; date: string | null; years: number | null }[];
  };
  alerts: { id: string; severity: "info" | "warning"; message: string; href: string }[];
  recruitment: {
    openVacancies: number;
    totalCandidates: number;
    interviewsToday: number;
    funnel: Record<string, number>;
  } | null;
  unavailable: string[];
}

/** Each KPI links into the employee list pre-filtered to the records it counts. */
const KPI_CARDS: {
  key: string;
  label: string;
  icon: typeof Users;
  href: string;
  tone?: "warning" | "danger";
}[] = [
  { key: "totalEmployees", label: "Total employees", icon: Users, href: "/employees" },
  { key: "teachingStaff", label: "Teaching staff", icon: GraduationCap, href: "/employees?category=teacher" },
  { key: "nonTeachingStaff", label: "Non-teaching staff", icon: Briefcase, href: "/employees" },
  { key: "activeEmployees", label: "Active", icon: UserCheck, href: "/employees?employmentStatus=active" },
  { key: "onProbation", label: "On probation", icon: Clock, href: "/employees?employmentStatus=probation" },
  { key: "onLeave", label: "On leave", icon: CalendarDays, href: "/employees?employmentStatus=on_leave" },
  { key: "noticePeriod", label: "Serving notice", icon: UserPlus, href: "/employees?employmentStatus=notice_period", tone: "warning" },
  { key: "newJoiners", label: "Joined (30 days)", icon: UserPlus, href: "/employees?sortBy=joiningDate&sortDir=desc" },
  { key: "expiringDocuments", label: "Documents expiring", icon: FileWarning, href: "/employees", tone: "warning" },
  { key: "pendingDocuments", label: "Documents pending", icon: FileClock, href: "/employees" },
];

const QUICK_ACTIONS: { label: string; href: string; module: Parameters<ReturnType<typeof useCan>>[0]; action: Parameters<ReturnType<typeof useCan>>[1] }[] = [
  { label: "Add employee", href: "/employees/new", module: "employees", action: "create" },
  { label: "Departments", href: "/school/departments", module: "departments", action: "view" },
  { label: "Designations", href: "/hr/designations", module: "designations", action: "view" },
  { label: "Employee types", href: "/hr/employee-types", module: "employeeTypes", action: "view" },
];

export function HrDashboard() {
  const can = useCan();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hr/dashboard")
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
        if (!cancelled) setError(e?.error ?? "Couldn't load the HR dashboard.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!data) return <LoadingState />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.filter((a) => can(a.module, a.action)).map((action) => (
          <Button key={action.href} asChild variant="secondary" size="sm">
            <Link href={action.href}>
              <Plus className="size-4" /> {action.label}
            </Link>
          </Button>
        ))}
      </div>

      {data.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                className="flex items-start gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                {alert.severity === "warning" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-600" aria-hidden="true" />
                ) : (
                  <Info className="mt-0.5 size-4 shrink-0 text-info-600" aria-hidden="true" />
                )}
                <span className="text-foreground">{alert.message}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <section aria-label="Key figures">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {KPI_CARDS.map((kpi) => (
            <KpiCard
              key={kpi.key}
              label={kpi.label}
              value={data.kpis[kpi.key] ?? 0}
              icon={kpi.icon}
              href={kpi.href}
              tone={kpi.tone}
            />
          ))}
        </div>
      </section>

      <section aria-label="Workforce breakdown" className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Teaching vs non-teaching" rows={data.charts.teachingSplit ?? []} />
        <BreakdownCard title="By department" rows={data.charts.byDepartment ?? []} />
        <BreakdownCard title="By employee type" rows={data.charts.byEmployeeType ?? []} />
        <BreakdownCard title="By campus" rows={data.charts.byCampus ?? []} />
        <BreakdownCard title="By gender" rows={data.charts.byGender ?? []} />

        <Card>
          <CardHeader>
            <CardTitle>Upcoming (next 30 days)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <UpcomingList
              icon={Cake}
              title="Birthdays"
              items={data.upcoming.birthdays.map((b) => ({ id: b.id, name: b.fullName, detail: formatDay(b.date) }))}
            />
            <UpcomingList
              icon={Award}
              title="Work anniversaries"
              items={data.upcoming.anniversaries.map((a) => ({
                id: a.id,
                name: a.fullName,
                detail: `${formatDay(a.date)}${a.years ? ` · ${a.years} yr` : ""}`,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      {data.recruitment && (
        <section aria-label="Recruitment">
          <Card>
            <CardHeader>
              <CardTitle>Recruitment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Open vacancies" value={data.recruitment.openVacancies} href="/hr/vacancies?status=open" />
                <MiniStat label="Candidates" value={data.recruitment.totalCandidates} href="/hr/candidates" />
                <MiniStat label="Interviews today" value={data.recruitment.interviewsToday} href="/hr/interviews" />
              </div>
              <Funnel funnel={data.recruitment.funnel} />
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-label="Modules not yet available">
        <Card>
          <CardHeader>
            <CardTitle>Coming with later phases</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={CalendarClock}
              title="Attendance, leave, payroll and performance figures aren't available yet"
              description="These panels stay empty on purpose rather than showing sample numbers. They fill in automatically once those modules are built — the employee records they read from already exist."
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  href: string;
  tone?: "warning" | "danger";
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            "size-4 shrink-0",
            tone === "warning" && value > 0 ? "text-warning-600" : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          tone === "warning" && value > 0 ? "text-warning-600" : "text-foreground",
        )}
      >
        {value}
      </p>
    </Link>
  );
}

function MiniStat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary-400">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </Link>
  );
}

/**
 * Horizontal bars rather than a chart library: these are single-series category
 * counts, where a labelled proportional bar is easier to read than a pie and
 * needs no extra dependency.
 */
function BreakdownCard({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const sorted = [...rows].sort((a, b) => b.value - a.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {sorted.map((row) => {
              const pct = Math.round((row.value / total) * 100);
              return (
                <li key={row.label} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-foreground">{row.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {row.value} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingList({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Cake;
  title: string;
  items: { id: string; name: string; detail: string }[];
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" /> {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">None in the next 30 days.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-2 text-sm">
              <Link href={`/employees/${item.id}`} className="truncate hover:underline">
                {item.name}
              </Link>
              <span className="shrink-0 text-muted-foreground">{item.detail}</span>
            </li>
          ))}
          {items.length > 5 && <li className="text-xs text-muted-foreground">+{items.length - 5} more</li>}
        </ul>
      )}
    </div>
  );
}

const FUNNEL_STAGES = [
  ["applications", "Applications"],
  ["screening", "Screening"],
  ["shortlisted", "Shortlisted"],
  ["interview", "Interview"],
  ["selected", "Selected"],
  ["offered", "Offered"],
  ["joined", "Joined"],
] as const;

function Funnel({ funnel }: { funnel: Record<string, number> }) {
  const max = Math.max(1, funnel.applications ?? 0);
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">Hiring funnel</p>
      <ul className="flex flex-col gap-1.5">
        {FUNNEL_STAGES.map(([key, label]) => {
          const value = funnel[key] ?? 0;
          const pct = Math.round((value / max) * 100);
          return (
            <li key={key} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-black/5 dark:bg-white/10">
                <div className="h-full rounded bg-accent-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-foreground">{value}</span>
            </li>
          );
        })}
      </ul>
      {(funnel.rejected ?? 0) > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          <Badge variant="neutral">{funnel.rejected} rejected</Badge>
        </p>
      )}
    </div>
  );
}

function formatDay(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
