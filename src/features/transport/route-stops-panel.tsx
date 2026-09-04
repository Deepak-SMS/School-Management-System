"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Plus, Trash2, MapPin } from "lucide-react";
import { transportRouteService, transportStopService } from "@/services/transportService";
import type { TransportRouteStopRecord, TransportStopRecord } from "@/types/transport";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

export function RouteStopsPanel({
  routeId,
  stops,
  onChanged,
}: {
  routeId: string;
  stops: TransportRouteStopRecord[];
  onChanged: () => void;
}) {
  const can = useCan();
  const canEdit = can("transportRoutes", "edit");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<TransportRouteStopRecord | null>(null);

  async function move(routeStopId: string, direction: "up" | "down") {
    try {
      await transportRouteService.moveStop(routeId, routeStopId, direction);
      onChanged();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't move the stop.", variant: "danger" });
    }
  }

  async function updateTimes(routeStopId: string, patch: { pickupTime?: string; dropTime?: string }) {
    try {
      await transportRouteService.updateStop(routeId, routeStopId, patch);
      onChanged();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't update the stop.", variant: "danger" });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await transportRouteService.removeStop(routeId, deleting.id);
      toast({ title: "Stop removed from route", variant: "success" });
      setDeleting(null);
      onChanged();
    } catch (e) {
      toast({ title: (e as ApiError)?.error ?? "Couldn't remove the stop.", variant: "danger" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {stops.length} stop{stops.length === 1 ? "" : "s"}
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add stop
          </Button>
        )}
      </div>

      {stops.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No stops on this route yet"
          description="Add stops in the order the vehicle visits them."
          action={canEdit ? <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> Add stop</Button> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Stop</TableHead>
              <TableHead>Pickup time</TableHead>
              <TableHead>Drop time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stops.map((rs, index) => (
              <TableRow key={rs.id}>
                <TableCell className="tabular-nums text-muted-foreground">{rs.sequenceOrder}</TableCell>
                <TableCell className="font-medium">{rs.stop.name}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <Input
                      className="h-8 w-28"
                      defaultValue={rs.pickupTime ?? ""}
                      placeholder="7:15 AM"
                      onBlur={(e) => e.target.value !== (rs.pickupTime ?? "") && updateTimes(rs.id, { pickupTime: e.target.value })}
                    />
                  ) : (
                    rs.pickupTime ?? "—"
                  )}
                </TableCell>
                <TableCell>
                  {canEdit ? (
                    <Input
                      className="h-8 w-28"
                      defaultValue={rs.dropTime ?? ""}
                      placeholder="3:45 PM"
                      onBlur={(e) => e.target.value !== (rs.dropTime ?? "") && updateTimes(rs.id, { dropTime: e.target.value })}
                    />
                  ) : (
                    rs.dropTime ?? "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => move(rs.id, "up")} aria-label="Move up">
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={index === stops.length - 1} onClick={() => move(rs.id, "down")} aria-label="Move down">
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-danger-600 hover:bg-danger-50 hover:text-danger-600" onClick={() => setDeleting(rs)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AddStopModal
        open={adding}
        routeId={routeId}
        excludeStopIds={stops.map((s) => s.stopId)}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          onChanged();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remove ${deleting?.stop.name ?? "stop"} from this route?`}
        description="Stops used as a student's pickup or drop point on this route can't be removed until they're reassigned."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function AddStopModal({
  open,
  routeId,
  excludeStopIds,
  onClose,
  onSaved,
}: {
  open: boolean;
  routeId: string;
  excludeStopIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [allStops, setAllStops] = useState<TransportStopRecord[]>([]);
  const [stopId, setStopId] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropTime, setDropTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    transportStopService.list({ status: "active" }).then((r) => setAllStops(r.data)).catch(() => undefined);
  }, [open]);

  const options = allStops.filter((s) => !excludeStopIds.includes(s.id));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await transportRouteService.addStop(routeId, { stopId, pickupTime: pickupTime || undefined, dropTime: dropTime || undefined });
      toast({ title: "Stop added", variant: "success" });
      setStopId("");
      setPickupTime("");
      setDropTime("");
      onSaved();
    } catch (e) {
      setError((e as ApiError)?.error ?? "Couldn't add the stop.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Add stop to route">
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormField label="Stop" required>
            {(f) => (
              <Select value={stopId} onValueChange={setStopId}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="Choose a stop" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Pickup time">{(f) => <Input {...f} value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} placeholder="7:15 AM" />}</FormField>
            <FormField label="Drop time">{(f) => <Input {...f} value={dropTime} onChange={(e) => setDropTime(e.target.value)} placeholder="3:45 PM" />}</FormField>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} isLoading={busy} disabled={!stopId}>
              Add stop
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
