"use client";

import { useEffect, useState } from "react";
import { timetableService } from "@/services/timetableService";
import type { TimetableSlotRecord } from "@/types/timetable";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/constants/school";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarClock } from "lucide-react";

export function MyTimetableView() {
  const [slots, setSlots] = useState<TimetableSlotRecord[] | null>(null);

  useEffect(() => {
    timetableService.myTimetable().then((r) => setSlots(r.data));
  }, []);

  if (slots === null) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (slots.length === 0) {
    return <EmptyState icon={CalendarClock} title="No published timetable yet" description="Your classes will show up here once a timetable is published." />;
  }

  const periodsById = new Map<string, TimetableSlotRecord["period"]>();
  for (const slot of slots) periodsById.set(slot.period.id, slot.period);
  const periods = Array.from(periodsById.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  const workingDays = WEEKDAYS.filter((day) => slots.some((s) => s.dayOfWeek === day));

  function slotFor(day: string, periodId: string) {
    return slots!.find((s) => s.dayOfWeek === day && s.period.id === periodId);
  }

  return (
    <Card className="overflow-x-auto p-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border p-2 text-left font-medium text-muted-foreground">Period</th>
            {workingDays.map((day) => (
              <th key={day} className="border border-border p-2 text-left font-medium text-muted-foreground">
                {WEEKDAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.id}>
              <td className="border border-border p-2 align-top">
                <p className="font-medium text-foreground">{period.label}</p>
                <p className="text-xs text-muted-foreground">
                  {period.startTime}–{period.endTime}
                </p>
              </td>
              {workingDays.map((day) => {
                const slot = slotFor(day, period.id);
                return (
                  <td key={day} className="border border-border p-2 align-top">
                    {slot ? (
                      <div>
                        <p className="font-medium text-foreground">{slot.subject.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {slot.section.class?.name} {slot.section.name}
                        </p>
                        {slot.room && <p className="text-xs text-muted-foreground">{slot.room.name}</p>}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Free</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
