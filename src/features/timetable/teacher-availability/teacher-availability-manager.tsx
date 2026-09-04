"use client";

import { useEffect, useState } from "react";
import { staffService } from "@/services/staffService";
import { timetableService } from "@/services/timetableService";
import type { StaffRecord } from "@/types/staff";
import type { TimingSetRecord } from "@/types/timetable";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/constants/school";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

interface Blackout {
  dayOfWeek: string;
  periodId: string | null;
}

export function TeacherAvailabilityManager() {
  const [teachers, setTeachers] = useState<StaffRecord[]>([]);
  const [timingSets, setTimingSets] = useState<TimingSetRecord[]>([]);
  const [staffId, setStaffId] = useState("");
  const [timingSetId, setTimingSetId] = useState("");
  const [maxPeriodsPerDay, setMaxPeriodsPerDay] = useState("");
  const [maxConsecutivePeriods, setMaxConsecutivePeriods] = useState("");
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    staffService.list({ pageSize: 200, category: "teacher" }).then((r) => setTeachers(r.data));
    timetableService.listTimingSets().then((r) => {
      setTimingSets(r.data);
      if (r.data[0]) setTimingSetId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!staffId) return;
    const timeout = setTimeout(() => {
      setLoading(true);
      timetableService
        .getStaffAvailability(staffId)
        .then((r) => {
          setMaxPeriodsPerDay(r.maxPeriodsPerDay != null ? String(r.maxPeriodsPerDay) : "");
          setMaxConsecutivePeriods(r.maxConsecutivePeriods != null ? String(r.maxConsecutivePeriods) : "");
          setBlackouts(r.unavailability.map((u) => ({ dayOfWeek: u.dayOfWeek, periodId: u.periodId })));
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timeout);
  }, [staffId]);

  function isBlocked(day: string, periodId: string | null) {
    return blackouts.some((b) => b.dayOfWeek === day && b.periodId === periodId);
  }

  function toggleWholeDay(day: string) {
    setBlackouts((prev) =>
      isBlocked(day, null) ? prev.filter((b) => !(b.dayOfWeek === day && b.periodId === null)) : [...prev, { dayOfWeek: day, periodId: null }],
    );
  }

  function togglePeriod(day: string, periodId: string) {
    setBlackouts((prev) =>
      isBlocked(day, periodId) ? prev.filter((b) => !(b.dayOfWeek === day && b.periodId === periodId)) : [...prev, { dayOfWeek: day, periodId }],
    );
  }

  async function handleSave() {
    if (!staffId) return;
    setSaving(true);
    try {
      await timetableService.updateStaffAvailability(staffId, {
        maxPeriodsPerDay: maxPeriodsPerDay ? Number(maxPeriodsPerDay) : undefined,
        maxConsecutivePeriods: maxConsecutivePeriods ? Number(maxConsecutivePeriods) : undefined,
        unavailability: blackouts as { dayOfWeek: (typeof WEEKDAYS)[number]; periodId: string | null }[],
      });
      toast({ title: "Availability saved", variant: "success" });
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't save availability.", variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  const activeTimingSet = timingSets.find((ts) => ts.id === timingSetId);
  const teachingPeriods = activeTimingSet?.periods.filter((p) => p.kind === "teaching") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Teacher</label>
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">View periods from</label>
          <Select value={timingSetId} onValueChange={setTimingSetId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a timing set" />
            </SelectTrigger>
            <SelectContent>
              {timingSets.map((ts) => (
                <SelectItem key={ts.id} value={ts.id}>
                  {ts.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {staffId && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Max periods / day" description="Leave blank for no cap.">
              {(f) => <Input {...f} type="number" min={1} value={maxPeriodsPerDay} onChange={(e) => setMaxPeriodsPerDay(e.target.value)} />}
            </FormField>
            <FormField label="Max consecutive periods" description="Leave blank for no cap.">
              {(f) => <Input {...f} type="number" min={1} value={maxConsecutivePeriods} onChange={(e) => setMaxConsecutivePeriods(e.target.value)} />}
            </FormField>
          </div>

          <Card className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left font-medium text-muted-foreground">Day</th>
                  <th className="p-2 text-left font-medium text-muted-foreground">Unavailable all day</th>
                  {teachingPeriods.map((p) => (
                    <th key={p.id} className="p-2 text-left font-medium text-muted-foreground">
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((day) => (
                  <tr key={day} className="border-t border-border">
                    <td className="p-2 font-medium text-foreground">{WEEKDAY_LABELS[day]}</td>
                    <td className="p-2">
                      <Checkbox checked={isBlocked(day, null)} onCheckedChange={() => toggleWholeDay(day)} />
                    </td>
                    {teachingPeriods.map((p) => (
                      <td key={p.id} className="p-2">
                        <Checkbox
                          checked={isBlocked(day, null) || isBlocked(day, p.id)}
                          disabled={isBlocked(day, null)}
                          onCheckedChange={() => togglePeriod(day, p.id)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Button onClick={handleSave} isLoading={saving} className="self-start">
            Save availability
          </Button>
        </>
      )}
    </div>
  );
}
