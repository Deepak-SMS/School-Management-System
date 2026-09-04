"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, DoorOpen } from "lucide-react";
import { timetableService } from "@/services/timetableService";
import type { RoomRecord } from "@/types/timetable";
import type { RoomInput } from "@/lib/validation/timetable";
import { ROOM_TYPE_LABELS } from "@/lib/constants/timetable";
import { RoomForm } from "@/features/timetable/rooms/room-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent } from "@/components/ui/modal";
import { toast } from "@/hooks/use-toast";

export function RoomsManager() {
  const [rooms, setRooms] = useState<RoomRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<"create" | RoomRecord | null>(null);

  function load() {
    setLoading(true);
    timetableService
      .listRooms()
      .then((r) => setRooms(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCreate(input: RoomInput) {
    await timetableService.createRoom(input);
    toast({ title: "Room added", variant: "success" });
    setModalMode(null);
    load();
  }

  async function handleUpdate(id: string, input: RoomInput) {
    await timetableService.updateRoom(id, input);
    toast({ title: "Room updated", variant: "success" });
    setModalMode(null);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setModalMode("create")}>
          <Plus className="size-4" /> Add Room
        </Button>
      </div>

      {loading && <TableSkeleton rows={4} columns={4} />}

      {!loading && rooms && rooms.length === 0 && (
        <EmptyState icon={DoorOpen} title="No rooms yet" description="Add classrooms and labs so the generator can assign them." />
      )}

      {!loading && rooms && rooms.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="font-medium">
                  {room.name}
                  {room.buildingName && <p className="text-xs font-normal text-muted-foreground">{room.buildingName}</p>}
                </TableCell>
                <TableCell>{ROOM_TYPE_LABELS[room.roomType as keyof typeof ROOM_TYPE_LABELS] ?? room.roomType}</TableCell>
                <TableCell>{room.capacity ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={room.status === "active" ? "success" : "neutral"}>{room.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setModalMode(room)}>
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Modal open={modalMode !== null} onOpenChange={(v) => !v && setModalMode(null)}>
        <ModalContent title={modalMode === "create" ? "Add room" : "Edit room"}>
          <RoomForm
            defaultValues={modalMode && modalMode !== "create" ? (modalMode as unknown as Partial<RoomInput>) : undefined}
            submitLabel={modalMode === "create" ? "Add room" : "Save"}
            onSubmit={(input) => (modalMode === "create" ? handleCreate(input) : handleUpdate((modalMode as RoomRecord).id, input))}
          />
        </ModalContent>
      </Modal>
    </div>
  );
}
