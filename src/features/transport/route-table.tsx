"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Route as RouteIcon, Trash2 } from "lucide-react";
import { transportRouteService } from "@/services/transportService";
import type { TransportRouteRecord } from "@/types/transport";
import { ROUTE_STATUS_LABELS } from "@/lib/constants/transport";
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

export function RouteTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "transportRoutes", "create");
  const canDelete = hasPermission(user.role, "transportRoutes", "delete");

  const [result, setResult] = useState<{ data: TransportRouteRecord[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<TransportRouteRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    transportRouteService
      .list({ q: search || undefined })
      .then(setResult)
      .catch(() => setError("Couldn't load routes."))
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
      await transportRouteService.remove(deleting.id);
      toast({ title: "Route deleted", variant: "success" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't delete the route.", variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input leadingIcon={<Search />} placeholder="Search by name, number, destination..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/transport/routes/new">
              <Plus className="size-4" /> Add Route
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={6} />}
      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={RouteIcon}
          title="No routes found"
          description="Add a route, then build its stop list and assign a vehicle and driver."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/transport/routes/new">
                  <Plus className="size-4" /> Add Route
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
              <TableHead>Route</TableHead>
              <TableHead>Stops</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((route) => (
              <TableRow key={route.id}>
                <TableCell className="font-medium">
                  <Link href={`/transport/routes/${route.id}`} className="hover:underline">
                    {route.name}
                  </Link>
                  {route.routeNumber && <span className="ml-2 text-xs text-muted-foreground">{route.routeNumber}</span>}
                </TableCell>
                <TableCell className="tabular-nums">{route.counts?.stops ?? 0}</TableCell>
                <TableCell className="text-muted-foreground">{route.currentAssignment?.vehicle.vehicleNumber ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {route.currentAssignment?.driver.staff?.fullName ?? route.currentAssignment?.driver.fullName ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums">{route.counts?.students ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={route.status === "active" ? "success" : "neutral"}>
                    {ROUTE_STATUS_LABELS[route.status as keyof typeof ROUTE_STATUS_LABELS] ?? route.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/transport/routes/${route.id}`}>Manage</Link>
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                        onClick={() => setDeleting(route)}
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
        title={`Delete ${deleting?.name ?? "route"}?`}
        description="This can't be undone. A route with students enrolled can't be deleted."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
