"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Wallet, ScrollText, CalendarClock, Bell } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useActiveChild } from "@/providers/active-child-provider";
import { useCurrentUser } from "@/providers/user-provider";
import { portalService } from "@/services/portalService";
import { notificationService } from "@/services/notificationService";
import type { PortalDashboard } from "@/types/portal";
import type { NotificationRecord } from "@/types/notification";

export function PortalDashboardView() {
  const user = useCurrentUser();
  const { activeChild, isLoading: childLoading } = useActiveChild();
  const [dashboard, setDashboard] = useState<PortalDashboard | null>(null);
  const [notices, setNotices] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!activeChild) return;
    setLoading(true);
    setError(null);
    Promise.all([portalService.getDashboard(activeChild.id), notificationService.list()])
      .then(([dashboardData, noticesData]) => {
        setDashboard(dashboardData);
        setNotices(noticesData.data);
      })
      .catch(() => setError("Couldn't load your dashboard."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (childLoading) return;
    const timeout = setTimeout(() => {
      if (!activeChild) {
        setLoading(false);
        return;
      }
      load();
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChild?.id, childLoading]);

  if (childLoading || loading) return <LoadingState />;

  if (!activeChild) {
    return (
      <EmptyState
        title="No student linked to this account yet"
        description="Ask your school administrator to grant portal access to a child."
      />
    );
  }

  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!dashboard) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {user.role === "parent" ? `${activeChild.firstName}'s overview` : "Your overview"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeChild.className}
          {activeChild.sectionName ? ` ${activeChild.sectionName}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Attendance this month"
          value={dashboard.attendance.attendancePct !== null ? `${dashboard.attendance.attendancePct}%` : "—"}
          icon={ClipboardCheck}
          tone="primary"
          description={`${dashboard.attendance.present} of ${dashboard.attendance.totalMarked} days present`}
        />
        <StatCard
          label="Next class"
          value={dashboard.nextClass ? dashboard.nextClass.subject.name : "None today"}
          icon={CalendarClock}
          tone="neutral"
          description={dashboard.nextClass ? dashboard.nextClass.period.startTime : undefined}
        />
        {dashboard.fees && (
          <StatCard
            label="Fees pending"
            value={`₹${dashboard.fees.totalPending.toLocaleString("en-IN")}`}
            icon={Wallet}
            tone={dashboard.fees.totalOverdue > 0 ? "danger" : "warning"}
            description={dashboard.fees.totalOverdue > 0 ? `₹${dashboard.fees.totalOverdue.toLocaleString("en-IN")} overdue` : undefined}
          />
        )}
        <StatCard label="Certificates" value={dashboard.certificateCount} icon={ScrollText} tone="success" />
      </div>

      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Notices</h2>
        </div>
        {notices.length === 0 ? (
          <EmptyState title="You're all caught up" description="New notices from your school will show up here." />
        ) : (
          <div className="divide-y divide-border">
            {notices.slice(0, 5).map((n) => (
              <div key={n.id} className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                {n.description && <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {user.role !== "parent" && (
        <p className="text-xs text-muted-foreground">
          Looking for exam results or homework? Those aren&apos;t available in the portal yet.{" "}
          <Link href="/portal/timetable" className="underline">
            See your timetable
          </Link>{" "}
          instead.
        </p>
      )}
    </div>
  );
}
