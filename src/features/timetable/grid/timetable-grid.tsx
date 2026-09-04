"use client";

import { useEffect, useState, useCallback } from "react";
import { timetableService } from "@/services/timetableService";
import type { PeriodRecord, TimetableSlotRecord } from "@/types/timetable";
import type { TimetableSlotInput } from "@/lib/validation/timetable";
import { WEEKDAY_LABELS } from "@/lib/constants/school";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { SlotEditorModal, type SlotEditorTarget } from "@/features/timetable/grid/slot-editor-modal";
import type { ApiError } from "@/services/studentService";

export function TimetableGrid({
  timetableId,
  periods,
  workingDays,
  sectionId,
  teacherId,
  roomId,
  editable,
}: {
  timetableId: string;
  periods: PeriodRecord[];
  workingDays: string[];
  sectionId?: string;
  teacherId?: string;
  roomId?: string;
  editable: boolean;
}) {
  const [slots, setSlots] = useState<TimetableSlotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SlotEditorTarget | null>(null);

  const load = useCallback(() => {
    if (!sectionId && !teacherId && !roomId) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timetableService
      .listSlots(timetableId, { sectionId, teacherId, roomId })
      .then((r) => setSlots(r.data))
      .finally(() => setLoading(false));
  }, [timetableId, sectionId, teacherId, roomId]);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  function slotFor(day: string, periodId: string) {
    return slots.find((s) => s.dayOfWeek === day && s.period.id === periodId);
  }

  function openCell(day: string, period: PeriodRecord) {
    if (!editable || !sectionId) return; // teacher/room views are read-only — editing happens from the section's own grid
    const existing = slotFor(day, period.id);
    setEditing({
      slotId: existing?.id,
      sectionId,
      dayOfWeek: day,
      periodId: period.id,
      periodLabel: period.label,
      dayLabel: WEEKDAY_LABELS[day as keyof typeof WEEKDAY_LABELS] ?? day,
      subjectId: existing?.subject.id,
      teacherId: existing?.teacher?.id ?? null,
      roomId: existing?.room?.id ?? null,
    });
  }

  async function handleSave(input: TimetableSlotInput, slotId?: string) {
    if (slotId) await timetableService.updateSlot(timetableId, slotId, input);
    else await timetableService.createSlot(timetableId, input);
    toast({ title: "Saved", variant: "success" });
    load();
  }

  async function handleDelete(slotId: string) {
    await timetableService.deleteSlot(timetableId, slotId);
    toast({ title: "Removed", variant: "success" });
    load();
  }

  if (!sectionId && !teacherId && !roomId) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Choose a section, teacher, or room to view its grid.</p>;
  }
  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border bg-background p-2 text-left font-medium text-muted-foreground">Period</th>
            {workingDays.map((day) => (
              <th key={day} className="border border-border bg-background p-2 text-left font-medium text-muted-foreground">
                {WEEKDAY_LABELS[day as keyof typeof WEEKDAY_LABELS] ?? day}
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
                if (period.kind !== "teaching") {
                  return (
                    <td key={day} className="border border-border bg-black/[.02] p-2 text-center text-xs text-muted-foreground dark:bg-white/[.02]">
                      —
                    </td>
                  );
                }
                const slot = slotFor(day, period.id);
                return (
                  <td
                    key={day}
                    onClick={() => openCell(day, period)}
                    className={cn(
                      "border border-border p-2 align-top",
                      editable && sectionId && "cursor-pointer hover:bg-black/[.03] dark:hover:bg-white/[.03]",
                    )}
                  >
                    {slot ? (
                      <div className="flex flex-col gap-1">
                        <p className="font-medium text-foreground">{slot.subject.name}</p>
                        {slot.teacher && <p className="text-xs text-muted-foreground">{slot.teacher.fullName}</p>}
                        {slot.room && <p className="text-xs text-muted-foreground">{slot.room.name}</p>}
                        {slot.source === "manual" && (
                          <Badge variant="info" className="w-fit">
                            Manual
                          </Badge>
                        )}
                      </div>
                    ) : (
                      editable && sectionId && <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <SlotEditorModal
          target={editing}
          onClose={() => setEditing(null)}
          onSave={async (input, slotId) => {
            try {
              await handleSave(input, slotId);
            } catch (error) {
              throw error as ApiError;
            }
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
