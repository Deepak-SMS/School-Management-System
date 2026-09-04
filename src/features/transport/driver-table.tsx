"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, UserCog, Pencil, Trash2 } from "lucide-react";
import { transportDriverService } from "@/services/transportService";
import type { TransportDriverRecord } from "@/types/transport";
import { DRIVER_STATUS_LABELS } from "@/lib/constants/transport";
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

const STATUS_BADGE: Record<string, "success" | "warning" | "neutral"> = { active: "success", on_leave: "warning", inactive: "neutral" };

function driverName(driver: TransportDriverRecord) {
  return driver.staff?.fullName ?? driver.fullName ?? "Unnamed driver";
}

function driverPhone(driver: TransportDriverRecord) {
  return driver.staff?.mobileNumber ?? driver.phone ?? "—";
}

export function DriverTable() {
  const user = useCurrentUser();
  const canCreate = hasPermission(user.role, "transportDrivers", "create");
  const canEdit = hasPermission(user.role, "transportDrivers", "edit");
  const canDelete = hasPermission(user.role, "transportDrivers", "delete");

  const [result, setResult] = useState<{ data: TransportDriverRecord[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [deleting, setDeleting] = useState<TransportDriverRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    transportDriverService
      .list({ q: search || undefined, status: status || undefined })
      .then(setResult)
      .catch(() => setError("Couldn't load drivers."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await transportDriverService.remove(deleting.id);
      toast({ title: "Driver deleted", variant: "success" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't delete the driver.", variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input leadingIcon={<Search />} placeholder="Search by name, phone, license..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(DRIVER_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canCreate && (
          <Button asChild className="ml-auto">
            <Link href="/transport/drivers/new">
              <Plus className="size-4" /> Add Driver
            </Link>
          </Button>
        )}
      </div>

      {loading && <TableSkeleton rows={6} columns={5} />}
      {!loading && error && <ErrorState description={error} onRetry={load} />}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={UserCog}
          title="No drivers found"
          description="Add a school-employed or vendor driver to start assigning routes."
          action={
            canCreate ? (
              <Button asChild size="sm">
                <Link href="/transport/drivers/new">
                  <Plus className="size-4" /> Add Driver
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
              <TableHead>Driver</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>License</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((driver) => (
              <TableRow key={driver.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={driverName(driver).split(" ").map((n) => n[0]).slice(0, 2).join("")} size="sm" />
                    <div>
                      {driverName(driver)}
                      {driver.staffId && (
                        <Badge variant="neutral" className="ml-2">
                          Staff
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{driverPhone(driver)}</TableCell>
                <TableCell className="text-muted-foreground">{driver.licenseNumber ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[driver.status] ?? "neutral"}>{DRIVER_STATUS_LABELS[driver.status as keyof typeof DRIVER_STATUS_LABELS] ?? driver.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canEdit && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/transport/drivers/${driver.id}/edit`}>
                          <Pencil className="size-4" /> Edit
                        </Link>
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                        onClick={() => setDeleting(driver)}
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
        title={`Delete ${deleting ? driverName(deleting) : "driver"}?`}
        description="This can't be undone. A driver currently assigned to a route can't be deleted."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
