"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, DoorOpen, CalendarRange, UserX, CalendarClock } from "lucide-react";
import { timetableService } from "@/services/timetableService";
import type { TimetableSummary } from "@/types/timetable";
import { TIMETABLE_STATUS_LABELS } from "@/lib/constants/timetable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = { draft: "warning", published: "success", archived: "neutral" };

export function TimetablesList() {
  const [timetables, setTimetables] = useState<TimetableSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    timetableService
      .listTimetables()
      .then((r) => setTimetables(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href="/academics/timetable/setup/rooms">
            <DoorOpen className="size-4" /> Rooms
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/academics/timetable/setup/timing-sets">
            <CalendarRange className="size-4" /> Timing Sets
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/academics/timetable/setup/teacher-availability">
            <UserX className="size-4" /> Teacher Availability
          </Link>
        </Button>
        <Button asChild>
          <Link href="/academics/timetable/new">
            <Plus className="size-4" /> Create Timetable
          </Link>
        </Button>
      </div>

      {loading && <TableSkeleton rows={4} columns={5} />}

      {!loading && timetables && timetables.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="No timetables yet"
          description="Set up rooms and timing sets, then create your first timetable."
          action={
            <Button asChild size="sm">
              <Link href="/academics/timetable/new">
                <Plus className="size-4" /> Create Timetable
              </Link>
            </Button>
          }
        />
      )}

      {!loading && timetables && timetables.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Academic Year</TableHead>
              <TableHead>Timing Set</TableHead>
              <TableHead>Classes</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timetables.map((tt) => (
              <TableRow key={tt.id}>
                <TableCell className="font-medium">
                  <Link href={`/academics/timetable/${tt.id}`} className="hover:underline">
                    {tt.name}
                  </Link>
                </TableCell>
                <TableCell>{tt.academicYear.label}</TableCell>
                <TableCell>{tt.timingSet.name}</TableCell>
                <TableCell>{tt._count.classes}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_TONE[tt.status] ?? "neutral"}>{TIMETABLE_STATUS_LABELS[tt.status as keyof typeof TIMETABLE_STATUS_LABELS] ?? tt.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
