"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { studentTransportInputSchema, type StudentTransportInput } from "@/lib/validation/student-transport";
import { transportRouteService } from "@/services/transportService";
import type { TransportRouteDetailRecord } from "@/types/transport";
import { STUDENT_TRANSPORT_DIRECTIONS, STUDENT_TRANSPORT_DIRECTION_LABELS } from "@/lib/constants/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import type { ApiError } from "@/services/studentService";

interface StudentResult {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  class?: { name: string } | null;
  section?: { name: string } | null;
}

interface RouteOption {
  id: string;
  name: string;
  routeNumber?: string | null;
}

export function EnrollStudentTransportForm({ onSubmit }: { onSubmit: (input: StudentTransportInput) => Promise<void> }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [studentSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [routeId, setRouteId] = useState("");
  const [routeDetail, setRouteDetail] = useState<TransportRouteDetailRecord | null>(null);

  const [pickupStopId, setPickupStopId] = useState("");
  const [dropStopId, setDropStopId] = useState("");
  const [direction, setDirection] = useState<(typeof STUDENT_TRANSPORT_DIRECTIONS)[number]>("two_way");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    transportRouteService.list({ status: "active" }).then((r) => setRoutes(r.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!studentSearch.trim()) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      fetch(`/api/students?q=${encodeURIComponent(studentSearch)}&pageSize=8`)
        .then((r) => r.json())
        .then((body) => {
          if (!cancelled) setStudentResults(body.data ?? []);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [studentSearch]);

  function handleStudentSearchChange(value: string) {
    setStudentSearch(value);
    if (!value.trim()) setStudentResults([]);
  }

  useEffect(() => {
    if (!routeId) return;
    transportRouteService.get(routeId).then(setRouteDetail).catch(() => setRouteDetail(null));
  }, [routeId]);

  function handleRouteChange(value: string) {
    setRouteId(value);
    setRouteDetail(null);
    setPickupStopId("");
    setDropStopId("");
  }

  async function submit() {
    if (!selectedStudent) return;
    setBusy(true);
    setServerError(null);
    try {
      const input = studentTransportInputSchema.parse({
        studentId: selectedStudent.id,
        routeId,
        pickupStopId,
        dropStopId: dropStopId || undefined,
        direction,
        startDate,
      });
      await onSubmit(input);
    } catch (error) {
      const apiError = error as ApiError;
      setServerError(apiError?.error ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {serverError && (
        <Alert variant="danger" title="Couldn't enroll student">
          {serverError}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Student</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedStudent ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar initials={`${selectedStudent.firstName[0]}${selectedStudent.lastName[0]}`} size="sm" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedStudent.admissionNumber} · {selectedStudent.class?.name ?? ""} {selectedStudent.section?.name ?? ""}
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
                <X className="size-4" /> Change
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>Search by name or admission number</Label>
              <Input leadingIcon={<Search />} value={studentSearch} onChange={(e) => handleStudentSearchChange(e.target.value)} placeholder="Search students..." />
              {studentResults.length > 0 && (
                <div className="flex flex-col gap-1 rounded-md border border-border p-1">
                  {studentResults.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => {
                        setSelectedStudent(s);
                        setStudentSearch("");
                        setStudentResults([]);
                      }}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {s.firstName} {s.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.admissionNumber} · {s.class?.name ?? ""} {s.section?.name ?? ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Route &amp; stops</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Route" required className="sm:col-span-2">
            {(f) => (
              <Select value={routeId} onValueChange={handleRouteChange}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Choose a route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} {r.routeNumber ? `(${r.routeNumber})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Pickup stop" required description={!routeDetail ? "Choose a route first" : undefined}>
            {(f) => (
              <Select value={pickupStopId} onValueChange={setPickupStopId} disabled={!routeDetail}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Choose a stop" />
                </SelectTrigger>
                <SelectContent>
                  {routeDetail?.stops.map((rs) => (
                    <SelectItem key={rs.stopId} value={rs.stopId}>
                      {rs.stop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Drop stop" description="Optional — defaults to the pickup stop.">
            {(f) => (
              <Select value={dropStopId || "same"} onValueChange={(v) => setDropStopId(v === "same" ? "" : v)} disabled={!routeDetail}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Same as pickup" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same">Same as pickup</SelectItem>
                  {routeDetail?.stops.map((rs) => (
                    <SelectItem key={rs.stopId} value={rs.stopId}>
                      {rs.stop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Direction">
            {(f) => (
              <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
                <SelectTrigger id={f.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_TRANSPORT_DIRECTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {STUDENT_TRANSPORT_DIRECTION_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Start date" required>
            {(f) => <Input {...f} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
          </FormField>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={submit} isLoading={busy} disabled={!selectedStudent || !routeId || !pickupStopId || !startDate}>
          Enroll student
        </Button>
      </div>
    </div>
  );
}
