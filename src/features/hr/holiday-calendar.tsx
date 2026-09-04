"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { hrAttendanceService, type HolidayRecord } from "@/services/hrAttendanceService";
import type { ApiError } from "@/services/studentService";
import {
  APPLIES_TO,
  APPLIES_TO_LABELS,
  HOLIDAY_TYPES,
  HOLIDAY_TYPE_LABELS,
} from "@/lib/constants/hr-attendance";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { toast } from "@/hooks/use-toast";

export function HolidayCalendar() {
  const can = useCan();
  const canCreate = can("holidays", "create");

  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [holidays, setHolidays] = useState<HolidayRecord[] | null>(null);
  const [error, setError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [holidayType, setHolidayType] = useState<string>("school");
  const [appliesTo, setAppliesTo] = useState<string>("all");
  const [isWorkingDay, setIsWorkingDay] = useState(false);

  function load() {
    hrAttendanceService
      .listHolidays({ year })
      .then((r) => {
        setHolidays(r.data);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function save() {
    setFormError(null);
    setSaving(true);
    try {
      await hrAttendanceService.createHoliday({
        name,
        startDate,
        endDate: endDate || undefined,
        holidayType,
        appliesTo,
        isWorkingDay,
      });
      toast({ title: "Added to the calendar", variant: "success" });
      setOpen(false);
      setName("");
      setStartDate("");
      setEndDate("");
      setIsWorkingDay(false);
      load();
    } catch (e) {
      setFormError((e as ApiError)?.error ?? "That couldn't be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState onRetry={load} />;

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="info" title="This calendar drives attendance and payroll">
        Nobody is marked absent on a day listed here, and closed days don&apos;t count against anyone&apos;s leave
        balance or a month&apos;s working days.
      </Alert>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28"
          aria-label="Year"
        />
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add to calendar
          </Button>
        )}
      </div>

      {!holidays ? (
        <TableSkeleton />
      ) : holidays.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={`Nothing in the ${year} calendar`}
          description="Add public holidays, school holidays and vacations so attendance and payroll count the right days."
          action={
            canCreate ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Add to calendar
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Applies to</TableHead>
              <TableHead>Effect</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.map((h) => {
              const single = h.startDate.slice(0, 10) === h.endDate.slice(0, 10);
              return (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>
                    {h.startDate.slice(0, 10)}
                    {single ? "" : ` → ${h.endDate.slice(0, 10)}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {HOLIDAY_TYPE_LABELS[h.holidayType as keyof typeof HOLIDAY_TYPE_LABELS] ?? h.holidayType}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {APPLIES_TO_LABELS[h.appliesTo as keyof typeof APPLIES_TO_LABELS] ?? h.appliesTo}
                  </TableCell>
                  <TableCell>
                    <Badge variant={h.isWorkingDay ? "warning" : "neutral"}>
                      {h.isWorkingDay ? "School open" : "School closed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title="Add to the work calendar">
          <div className="flex flex-col gap-4">
            {formError && <Alert variant="danger">{formError}</Alert>}

            <FormField label="Name" required>
              {(f) => (
                <Input {...f} value={name} onChange={(e) => setName(e.target.value)} placeholder="Independence Day" />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="From" required>
                {(f) => <Input {...f} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
              </FormField>
              <FormField label="To" description="Leave blank for a single day">
                {(f) => <Input {...f} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Type">
                {() => (
                  <Select value={holidayType} onValueChange={setHolidayType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOLIDAY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {HOLIDAY_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField label="Applies to">
                {() => (
                  <Select value={appliesTo} onValueChange={setAppliesTo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPLIES_TO.map((a) => (
                        <SelectItem key={a} value={a}>
                          {APPLIES_TO_LABELS[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <Switch checked={isWorkingDay} onCheckedChange={setIsWorkingDay} aria-label="Special working day" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Special working day</p>
                <p className="text-muted-foreground">
                  The school is open on what would normally be a weekly off — an exam Sunday, say. This overrides the
                  weekly off rather than adding a closure.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save} isLoading={saving} disabled={!name || !startDate}>
                Add
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
}
