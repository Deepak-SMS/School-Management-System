"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useActiveChild } from "@/providers/active-child-provider";
import { portalService } from "@/services/portalService";
import type { PortalAttendanceResponse } from "@/types/portal";

const statusVariant: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  present: "success",
  late: "warning",
  half_day: "warning",
  absent: "danger",
  leave: "neutral",
};

export function PortalAttendanceView() {
  const { activeChild, isLoading: childLoading } = useActiveChild();
  const [result, setResult] = useState<PortalAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!activeChild) return;
    setLoading(true);
    setError(null);
    portalService
      .getAttendance(activeChild.id)
      .then(setResult)
      .catch(() => setError("Couldn't load attendance."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (childLoading) return;
    // Deferred a tick so the guard's setState isn't called synchronously
    // within the effect body — same idiom as student-table.tsx's debounce.
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
  if (!activeChild) return <EmptyState title="No student linked to this account yet" />;
  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!result) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">This month, for {activeChild.firstName}.</p>
      </div>

      <Card className="flex items-center gap-4 p-4">
        <div className="text-3xl font-semibold text-foreground">
          {result.summary.attendancePct !== null ? `${result.summary.attendancePct}%` : "—"}
        </div>
        <div className="text-sm text-muted-foreground">
          {result.summary.present} present out of {result.summary.totalMarked} marked days
        </div>
      </Card>

      {result.data.length === 0 ? (
        <EmptyState title="No attendance marked yet this month" />
      ) : (
        <Card className="divide-y divide-border p-0">
          {result.data.map((record) => (
            <div key={record.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-foreground">
                {new Date(record.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </span>
              <Badge variant={statusVariant[record.status] ?? "neutral"}>{record.status.replace("_", " ")}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
