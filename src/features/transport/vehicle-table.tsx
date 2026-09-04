"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Bus, Pencil, Trash2 } from "lucide-react";
import { transportVehicleService } from "@/services/transportService";
import type { TransportVehicleListResponse, TransportVehicleRecord } from "@/types/transport";
import { VEHICLE_TYPE_LABELS, VEHICLE_STATUS_LABELS } from "@/lib/constants/transport";
import { useCurrentUser } from "@/providers/user-provider";
import { hasPermission } from "@/config/permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

const PAGE_SIZE = 20;

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  active: "success",
  in_service: "success",
  maintenance: "warning",
  inactive: "neutral",
  retired: "danger",
};

export function VehicleTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "transportVehicles", "create");
  const canEdit = hasPermission(user.role, "transportVehicles", "edit");
  const canDelete = hasPermission(user.role, "transportVehicles", "delete");

  const [result, setResult] = useState<TransportVehicleListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<TransportVehicleRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    transportVehicleService
      .list({ q: search || undefined, status: status || undefined, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setError("Couldn't load vehicles."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await transportVehicleService.remove(deleting.id);
      toast({ title: "Vehicle deleted", variant: "success" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't delete the vehicle.", variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            leadingIcon={<Search />}
            placeholder="Search by number, make, model..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v === "all" ? "" : v);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/transport/vehicles/new">
              <Plus className="size-4" /> Add Vehicle
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={6} />}
      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={Bus}
          title="No vehicles found"
          description="Try a different search or filter, or add your first vehicle to the fleet."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/transport/vehicles/new">
                  <Plus className="size-4" /> Add Vehicle
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
                <TableHead>Vehicle Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Make &amp; Model</TableHead>
                <TableHead>Seating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell className="font-medium">{vehicle.vehicleNumber}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {VEHICLE_TYPE_LABELS[vehicle.vehicleType as keyof typeof VEHICLE_TYPE_LABELS] ?? vehicle.vehicleType}
                  </TableCell>
                  <TableCell>{[vehicle.make, vehicle.modelName].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell>{vehicle.seatingCapacity ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[vehicle.status] ?? "neutral"}>
                      {VEHICLE_STATUS_LABELS[vehicle.status as keyof typeof VEHICLE_STATUS_LABELS] ?? vehicle.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/transport/vehicles/${vehicle.id}`}>View</Link>
                      </Button>
                      {canEdit && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/transport/vehicles/${vehicle.id}/edit`}>
                            <Pencil className="size-4" /> Edit
                          </Link>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                          onClick={() => setDeleting(vehicle)}
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

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {result.total} vehicle{result.total === 1 ? "" : "s"}
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
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting?.vehicleNumber ?? "vehicle"}?`}
        description="This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
