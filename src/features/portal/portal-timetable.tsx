"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useActiveChild } from "@/providers/active-child-provider";
import { portalService } from "@/services/portalService";
import type { PortalTimetableSlot } from "@/types/portal";

const WEEK_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function PortalTimetableView() {
  const { activeChild, isLoading: childLoading } = useActiveChild();
  const [slots, setSlots] = useState<PortalTimetableSlot[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!activeChild) return;
    setLoading(true);
    setError(null);
    portalService
      .getTimetable(activeChild.id)
      .then((r) => setSlots(r.data))
      .catch(() => setError("Couldn't load the timetable."))
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
  if (!activeChild) return <EmptyState title="No student linked to this account yet" />;
  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!slots) return null;

  if (slots.length === 0) {
    return <EmptyState title="No published timetable yet" description="Check back once your school publishes one." />;
  }

  const byDay = WEEK_ORDER.map((day) => ({
    day,
    slots: slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.period.sortOrder - b.period.sortOrder),
  })).filter((d) => d.slots.length > 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Timetable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeChild.className}
          {activeChild.sectionName ? ` ${activeChild.sectionName}` : ""}
        </p>
      </div>

      {byDay.map(({ day, slots: daySlots }) => (
        <Card key={day} className="p-0">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-semibold capitalize text-foreground">{day}</h2>
          </div>
          <div className="divide-y divide-border">
            {daySlots.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{slot.subject.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {slot.teacher?.fullName ?? "—"}
                    {slot.room ? ` · ${slot.room.name}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {slot.period.startTime}–{slot.period.endTime}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
