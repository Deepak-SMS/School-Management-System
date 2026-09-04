"use client";

import { useEffect, useState } from "react";
import { Bus, UserCog, ArrowRightLeft } from "lucide-react";
import { transportRouteService, transportVehicleService, transportDriverService } from "@/services/transportService";
import type { TransportRouteAssignmentRecord, TransportVehicleRecord, TransportDriverRecord } from "@/types/transport";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

function driverName(driver: { fullName?: string | null; staff?: { fullName: string } | null }) {
  return driver.staff?.fullName ?? driver.fullName ?? "Unnamed driver";
}

export function RouteAssignmentPanel({
  routeId,
  currentAssignment,
  history,
  onChanged,
}: {
  routeId: string;
  currentAssignment: TransportRouteAssignmentRecord | null;
  history: TransportRouteAssignmentRecord[];
  onChanged: () => void;
}) {
  const can = useCan();
  const canEdit = can("transportRoutes", "edit");
  const [assigning, setAssigning] = useState(false);
  const past = history.filter((a) => a.id !== currentAssignment?.id);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          {currentAssignment ? (
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2.5">
                <Bus className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{currentAssignment.vehicle.vehicleNumber}</p>
                  <p className="text-xs text-muted-foreground">{currentAssignment.vehicle.vehicleType}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <UserCog className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{driverName(currentAssignment.driver)}</p>
                  <p className="text-xs text-muted-foreground">{currentAssignment.driver.staff?.mobileNumber ?? currentAssignment.driver.phone ?? "—"}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No vehicle or driver assigned yet.</p>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setAssigning(true)}>
              <ArrowRightLeft className="size-4" /> {currentAssignment ? "Change assignment" : "Assign vehicle & driver"}
            </Button>
          )}
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {past.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.vehicle.vehicleNumber}</TableCell>
                <TableCell>{driverName(a.driver)}</TableCell>
                <TableCell>{new Date(a.startDate).toLocaleDateString()}</TableCell>
                <TableCell>{a.effectiveTo ? new Date(a.effectiveTo).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {history.length === 0 && (
        <EmptyState icon={ArrowRightLeft} title="No assignment history" description="Once a vehicle and driver are assigned, changes are tracked here." />
      )}

      <AssignModal
        open={assigning}
        routeId={routeId}
        onClose={() => setAssigning(false)}
        onSaved={() => {
          setAssigning(false);
          onChanged();
        }}
      />
    </div>
  );
}

function AssignModal({ open, routeId, onClose, onSaved }: { open: boolean; routeId: string; onClose: () => void; onSaved: () => void }) {
  const [vehicles, setVehicles] = useState<TransportVehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<TransportDriverRecord[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    transportVehicleService.list({ status: "active", pageSize: 100 }).then((r) => setVehicles(r.data)).catch(() => undefined);
    transportDriverService.list({ status: "active" }).then((r) => setDrivers(r.data)).catch(() => undefined);
  }, [open]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await transportRouteService.assign(routeId, { vehicleId, driverId, startDate, note: note || undefined });
      toast({ title: "Route assignment updated", variant: "success" });
      onSaved();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't update the assignment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Assign vehicle & driver">
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Vehicle" required>
            {(f) => (
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Choose a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vehicleNumber} {v.modelName ? `· ${v.modelName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Driver" required>
            {(f) => (
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Choose a driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {driverName(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label="Effective from" required>
            {(f) => <Input {...f} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
          </FormField>

          <FormField label="Note">{(f) => <Input {...f} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />}</FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy} disabled={!vehicleId || !driverId || !startDate}>
              Save assignment
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
