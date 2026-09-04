"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, MapPin, Pencil, Trash2 } from "lucide-react";
import { transportStopService } from "@/services/transportService";
import type { TransportStopRecord } from "@/types/transport";
import { STOP_STATUS_LABELS } from "@/lib/constants/transport";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

export function StopTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "transportStops", "create");
  const canEdit = hasPermission(user.role, "transportStops", "edit");
  const canDelete = hasPermission(user.role, "transportStops", "delete");

  const [result, setResult] = useState<{ data: TransportStopRecord[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<TransportStopRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    transportStopService
      .list({ q: search || undefined })
      .then(setResult)
      .catch(() => setError("Couldn't load stops."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await transportStopService.remove(deleting.id);
      toast({ title: "Stop deleted", variant: "success" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't delete the stop.", variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input leadingIcon={<Search />} placeholder="Search by name, code, landmark..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/transport/stops/new">
              <Plus className="size-4" /> Add Stop
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={5} />}
      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="No stops found"
          description="Add the pickup/drop points your routes will use."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/transport/stops/new">
                  <Plus className="size-4" /> Add Stop
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Landmark</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((stop) => (
              <TableRow key={stop.id}>
                <TableCell className="font-medium">{stop.name}</TableCell>
                <TableCell className="text-muted-foreground">{stop.code ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{stop.landmark ?? "—"}</TableCell>
                <TableCell>{stop.distanceFromSchool != null ? `${stop.distanceFromSchool} km` : "—"}</TableCell>
                <TableCell>
                  <Badge variant={stop.status === "active" ? "success" : "neutral"}>
                    {STOP_STATUS_LABELS[stop.status as keyof typeof STOP_STATUS_LABELS] ?? stop.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canEdit && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/transport/stops/${stop.id}/edit`}>
                          <Pencil className="size-4" /> Edit
                        </Link>
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                        onClick={() => setDeleting(stop)}
                      >
                        <Trash2 className="size-4" /> Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "stop"}?`}
        description="This can't be undone. A stop still used by a route or a student's pickup/drop point can't be deleted."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
