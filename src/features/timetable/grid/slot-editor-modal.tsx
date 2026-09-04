"use client";

import { useEffect, useState } from "react";
import { subjectService } from "@/services/subjectService";
import { staffService } from "@/services/staffService";
import { timetableService } from "@/services/timetableService";
import type { SubjectRecord } from "@/types/subject";
import type { StaffRecord } from "@/types/staff";
import type { RoomRecord } from "@/types/timetable";
import type { TimetableSlotInput } from "@/lib/validation/timetable";
import { Modal, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import type { ApiError } from "@/services/studentService";

export interface SlotEditorTarget {
  slotId?: string;
  sectionId: string;
  dayOfWeek: string;
  periodId: string;
  periodLabel: string;
  dayLabel: string;
  subjectId?: string;
  teacherId?: string | null;
  roomId?: string | null;
}

export function SlotEditorModal({
  target,
  onClose,
  onSave,
  onDelete,
}: {
  target: SlotEditorTarget;
  onClose: () => void;
  onSave: (input: TimetableSlotInput, slotId?: string) => Promise<void>;
  onDelete: (slotId: string) => Promise<void>;
}) {
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [teachers, setTeachers] = useState<StaffRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [subjectId, setSubjectId] = useState(target.subjectId ?? "");
  const [teacherId, setTeacherId] = useState(target.teacherId ?? "");
  const [roomId, setRoomId] = useState(target.roomId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    subjectService.list({ pageSize: 200, status: "active" }).then((r) => setSubjects(r.data));
    staffService.list({ pageSize: 200, category: "teacher" }).then((r) => setTeachers(r.data));
    timetableService.listRooms().then((r) => setRooms(r.data));
  }, []);

  async function handleSave() {
    if (!subjectId) {
      setError("Choose a subject.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(
        {
          sectionId: target.sectionId,
          dayOfWeek: target.dayOfWeek as TimetableSlotInput["dayOfWeek"],
          periodId: target.periodId,
          subjectId,
          teacherId: teacherId || undefined,
          roomId: roomId || undefined,
        },
        target.slotId,
      );
      onClose();
    } catch (err) {
      setError((err as ApiError)?.error ?? "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!target.slotId) return;
    setDeleting(true);
    try {
      await onDelete(target.slotId);
      onClose();
    } catch (err) {
      setError((err as ApiError)?.error ?? "Couldn't remove.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent title={`${target.dayLabel} · ${target.periodLabel}`} size="sm">
        <div className="flex flex-col gap-4">
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Teacher</Label>
            <Select value={teacherId || "none"} onValueChange={(v) => setTeacherId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Room</Label>
            <Select value={roomId || "none"} onValueChange={(v) => setRoomId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No room</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ModalFooter className="-mx-5 -mb-4 mt-4">
          {target.slotId && (
            <Button variant="destructive" onClick={handleDelete} isLoading={deleting} className="mr-auto">
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
