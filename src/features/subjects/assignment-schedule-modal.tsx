"use client";

import { useEffect, useState } from "react";
import { timetableService } from "@/services/timetableService";
import type { RoomRecord } from "@/types/timetable";
import type { SubjectAssignmentRecord } from "@/types/subject";
import { Modal, ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { ApiError } from "@/services/studentService";

/** Sets the timetable generator's workload input for one SubjectAssignment — periods/week, double-period preference, preferred room. */
export function AssignmentScheduleModal({
  subjectId,
  assignment,
  onClose,
  onSaved,
}: {
  subjectId: string;
  assignment: SubjectAssignmentRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [periodsPerWeek, setPeriodsPerWeek] = useState(String(assignment.periodsPerWeek));
  const [preferDoublePeriod, setPreferDoublePeriod] = useState(assignment.preferDoublePeriod);
  const [preferredRoomId, setPreferredRoomId] = useState(assignment.preferredRoom?.id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    timetableService.listRooms().then((r) => setRooms(r.data));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await timetableService.updateAssignmentSchedule(subjectId, assignment.id, {
        periodsPerWeek: Number(periodsPerWeek) || 0,
        preferDoublePeriod,
        preferredRoomId: preferredRoomId || undefined,
      });
      toast({ title: "Schedule updated", variant: "success" });
      onSaved();
      onClose();
    } catch (error) {
      toast({ title: (error as ApiError)?.error ?? "Couldn't update schedule.", variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()}>
      <ModalContent title="Timetable schedule" description={`${assignment.class.name}${assignment.section ? ` · ${assignment.section.name}` : ""}`}>
        <div className="flex flex-col gap-4">
          <FormField label="Periods per week" description="How many periods a week the generator should place for this subject/class.">
            {(f) => (
              <Input {...f} type="number" min={0} max={60} value={periodsPerWeek} onChange={(e) => setPeriodsPerWeek(e.target.value)} />
            )}
          </FormField>

          <label className="flex items-center justify-between gap-3 text-sm text-foreground">
            Prefer double periods (back-to-back)
            <Switch checked={preferDoublePeriod} onCheckedChange={setPreferDoublePeriod} />
          </label>

          <FormField label="Preferred room" description="Optional — labs and specialist rooms. Leave unset for ordinary classroom teaching.">
            {(f) => (
              <Select value={preferredRoomId || "none"} onValueChange={(v) => setPreferredRoomId(v === "none" ? "" : v)}>
                <SelectTrigger id={f.id}>
                  <SelectValue placeholder="No room preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No room preference</SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        </div>

        <ModalFooter className="-mx-5 -mb-4 mt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
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
