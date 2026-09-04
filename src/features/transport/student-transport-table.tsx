"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Users } from "lucide-react";
import { studentTransportService, transportRouteService } from "@/services/transportService";
import type { StudentTransportRecord, TransportRouteRecord } from "@/types/transport";
import { STUDENT_TRANSPORT_DIRECTION_LABELS } from "@/lib/constants/transport";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const PAGE_SIZE = 20;

export function StudentTransportTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "transportStudents", "create");
  const canEdit = hasPermission(user.role, "transportStudents", "edit");

  const [routes, setRoutes] = useState<TransportRouteRecord[]>([]);
  const [result, setResult] = useState<{ data: StudentTransportRecord[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [routeId, setRouteId] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [ending, setEnding] = useState<StudentTransportRecord | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    transportRouteService.list().then((r) => setRoutes(r.data)).catch(() => undefined);
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    studentTransportService
      .list({ q: search || undefined, routeId: routeId || undefined, status: status || undefined, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setError("Couldn't load transport enrollments."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, routeId, status, page]);

  async function confirmEnd() {
    if (!ending) return;
    setIsEnding(true);
    try {
      await studentTransportService.update(ending.id, { status: "inactive", endDate: new Date().toISOString().slice(0, 10) });
      toast({ title: "Transport ended", variant: "success" });
      setEnding(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't end this enrollment.", variant: "danger" });
    } finally {
      setIsEnding(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search by name or admission number..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select value={routeId || "all"} onValueChange={(v) => { setPage(1); setRouteId(v === "all" ? "" : v); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Route" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All routes</SelectItem>
            {routes.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status || "all"} onValueChange={(v) => { setPage(1); setStatus(v === "all" ? "" : v); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/transport/students/new">
              <Plus className="size-4" /> Enroll Student
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={6} />}
      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={Users}
          title="No students enrolled"
          description="Enroll a student onto a route to replace the old free-text bus/route fields on their profile."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/transport/students/new">
                  <Plus className="size-4" /> Enroll Student
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Pickup / Drop</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={`${enrollment.student.firstName[0]}${enrollment.student.lastName[0]}`} size="sm" />
                      <div>
                        {enrollment.student.firstName} {enrollment.student.lastName}
                        <p className="text-xs font-normal text-muted-foreground">
                          {enrollment.student.admissionNumber} · {enrollment.student.class.name} {enrollment.student.section?.name ?? ""}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{enrollment.route.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {enrollment.pickupStop.name}
                    {enrollment.dropStop && enrollment.dropStop.id !== enrollment.pickupStop.id ? ` → ${enrollment.dropStop.name}` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {STUDENT_TRANSPORT_DIRECTION_LABELS[enrollment.direction as keyof typeof STUDENT_TRANSPORT_DIRECTION_LABELS] ?? enrollment.direction}
                  </TableCell>
                  <TableCell>
                    <Badge variant={enrollment.status === "active" ? "success" : "neutral"}>{enrollment.status === "active" ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && enrollment.status === "active" && (
                      <Button variant="ghost" size="sm" className="text-danger-600 hover:bg-danger-50 hover:text-danger-600" onClick={() => setEnding(enrollment)}>
                        End transport
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} enrollment{result.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(ending)}
        onOpenChange={(v) => !v && setEnding(null)}
        title={`End transport for ${ending ? `${ending.student.firstName} ${ending.student.lastName}` : "this student"}?`}
        description="Marks the enrollment inactive as of today. This can be reversed by enrolling them again."
        confirmLabel="End transport"
        variant="destructive"
        isLoading={isEnding}
        onConfirm={confirmEnd}
      />
    </div>
  );
}
