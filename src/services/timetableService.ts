import type { RoomInput, TimingSetInput, TimetableInput, TimetableUpdateInput, TeacherAvailabilityInput, TimetableSlotInput } from "@/lib/validation/timetable";
import type {
  GenerationReport,
  RoomRecord,
  StaffAvailabilityRecord,
  TimetableDetail,
  TimetableSlotRecord,
  TimetableSummary,
  TimingSetRecord,
} from "@/types/timetable";
import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const timetableService = {
  async listRooms(): Promise<{ data: RoomRecord[] }> {
    return parseOrThrow(await fetch("/api/rooms"));
  },
  async createRoom(input: RoomInput): Promise<RoomRecord> {
    return parseOrThrow(
      await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    );
  },
  async updateRoom(id: string, input: Partial<RoomInput>): Promise<RoomRecord> {
    return parseOrThrow(
      await fetch(`/api/rooms/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    );
  },
  async deleteRoom(id: string): Promise<void> {
    await parseOrThrow(await fetch(`/api/rooms/${id}`, { method: "DELETE" }));
  },

  async listTimingSets(): Promise<{ data: TimingSetRecord[] }> {
    return parseOrThrow(await fetch("/api/timing-sets"));
  },
  async createTimingSet(input: TimingSetInput): Promise<TimingSetRecord> {
    return parseOrThrow(
      await fetch("/api/timing-sets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    );
  },
  async updateTimingSet(id: string, input: TimingSetInput): Promise<TimingSetRecord> {
    return parseOrThrow(
      await fetch(`/api/timing-sets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    );
  },

  async getStaffAvailability(staffId: string): Promise<StaffAvailabilityRecord> {
    return parseOrThrow(await fetch(`/api/staff/${staffId}/availability`));
  },
  async updateStaffAvailability(staffId: string, input: TeacherAvailabilityInput): Promise<void> {
    await parseOrThrow(
      await fetch(`/api/staff/${staffId}/availability`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    );
  },

  async updateAssignmentSchedule(subjectId: string, assignmentId: string, input: { periodsPerWeek: number; preferDoublePeriod: boolean; preferredRoomId?: string }) {
    return parseOrThrow(
      await fetch(`/api/subjects/${subjectId}/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  },

  async listTimetables(): Promise<{ data: TimetableSummary[] }> {
    return parseOrThrow(await fetch("/api/timetables"));
  },
  async createTimetable(input: TimetableInput): Promise<TimetableSummary> {
    return parseOrThrow(
      await fetch("/api/timetables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    );
  },
  async getTimetable(id: string): Promise<TimetableDetail> {
    return parseOrThrow(await fetch(`/api/timetables/${id}`));
  },
  async updateTimetable(id: string, input: TimetableUpdateInput): Promise<TimetableSummary> {
    return parseOrThrow(
      await fetch(`/api/timetables/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    );
  },
  async generateTimetable(id: string): Promise<GenerationReport> {
    return parseOrThrow(await fetch(`/api/timetables/${id}/generate`, { method: "POST" }));
  },

  async listSlots(timetableId: string, params: { sectionId?: string; teacherId?: string; roomId?: string } = {}): Promise<{ data: TimetableSlotRecord[] }> {
    const query = new URLSearchParams();
    if (params.sectionId) query.set("sectionId", params.sectionId);
    if (params.teacherId) query.set("teacherId", params.teacherId);
    if (params.roomId) query.set("roomId", params.roomId);
    return parseOrThrow(await fetch(`/api/timetables/${timetableId}/slots?${query.toString()}`));
  },
  async createSlot(timetableId: string, input: TimetableSlotInput): Promise<TimetableSlotRecord> {
    return parseOrThrow(
      await fetch(`/api/timetables/${timetableId}/slots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    );
  },
  async updateSlot(timetableId: string, slotId: string, input: TimetableSlotInput): Promise<TimetableSlotRecord> {
    return parseOrThrow(
      await fetch(`/api/timetables/${timetableId}/slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  },
  async deleteSlot(timetableId: string, slotId: string): Promise<void> {
    await parseOrThrow(await fetch(`/api/timetables/${timetableId}/slots/${slotId}`, { method: "DELETE" }));
  },

  async myTimetable(): Promise<{ data: TimetableSlotRecord[] }> {
    return parseOrThrow(await fetch("/api/my/timetable"));
  },
};
