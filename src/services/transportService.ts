import type { ApiError } from "@/services/studentService";
import type { TransportVehicleInput } from "@/lib/validation/transport-vehicle";
import type { TransportDriverInput } from "@/lib/validation/transport-driver";
import type { TransportStopInput } from "@/lib/validation/transport-stop";
import type {
  TransportRouteInput,
  TransportRouteStopInput,
  TransportRouteAssignmentInput,
} from "@/lib/validation/transport-route";
import type { StudentTransportInput } from "@/lib/validation/student-transport";
import type {
  TransportVehicleListResponse,
  TransportVehicleRecord,
  TransportDriverRecord,
  TransportStopRecord,
  TransportRouteRecord,
  TransportRouteDetailRecord,
  TransportRouteStopRecord,
  TransportRouteAssignmentRecord,
  StudentTransportRecord,
} from "@/types/transport";

/**
 * Transport service layer. UI never calls `fetch` directly — it goes through
 * this, so swapping transport later is a change in one file (CLAUDE.md).
 */

export interface TransportVehicleListParams {
  q?: string;
  status?: string;
  vehicleType?: string;
  page?: number;
  pageSize?: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const transportVehicleService = {
  async list(params: TransportVehicleListParams = {}): Promise<TransportVehicleListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.vehicleType) query.set("vehicleType", params.vehicleType);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/transport-vehicles?${query.toString()}`);
    return parseOrThrow<TransportVehicleListResponse>(response);
  },

  async get(id: string): Promise<TransportVehicleRecord> {
    const response = await fetch(`/api/transport-vehicles/${id}`);
    return parseOrThrow<TransportVehicleRecord>(response);
  },

  async create(input: TransportVehicleInput): Promise<TransportVehicleRecord> {
    const response = await fetch("/api/transport-vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<TransportVehicleRecord>(response);
  },

  async update(id: string, input: Partial<TransportVehicleInput>): Promise<TransportVehicleRecord> {
    const response = await fetch(`/api/transport-vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<TransportVehicleRecord>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/transport-vehicles/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },
};

export const transportDriverService = {
  async list(params: { q?: string; status?: string } = {}): Promise<{ data: TransportDriverRecord[]; total: number }> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    return parseOrThrow(await fetch(`/api/transport-drivers?${query.toString()}`));
  },
  async get(id: string): Promise<TransportDriverRecord> {
    return parseOrThrow(await fetch(`/api/transport-drivers/${id}`));
  },
  async create(input: TransportDriverInput): Promise<TransportDriverRecord> {
    return postJson("/api/transport-drivers", input);
  },
  async update(id: string, input: Partial<TransportDriverInput>): Promise<TransportDriverRecord> {
    return postJson(`/api/transport-drivers/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<void> {
    await parseOrThrow(await fetch(`/api/transport-drivers/${id}`, { method: "DELETE" }));
  },
};

export const transportStopService = {
  async list(params: { q?: string; status?: string } = {}): Promise<{ data: TransportStopRecord[]; total: number }> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    return parseOrThrow(await fetch(`/api/transport-stops?${query.toString()}`));
  },
  async get(id: string): Promise<TransportStopRecord> {
    return parseOrThrow(await fetch(`/api/transport-stops/${id}`));
  },
  async create(input: TransportStopInput): Promise<TransportStopRecord> {
    return postJson("/api/transport-stops", input);
  },
  async update(id: string, input: Partial<TransportStopInput>): Promise<TransportStopRecord> {
    return postJson(`/api/transport-stops/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<void> {
    await parseOrThrow(await fetch(`/api/transport-stops/${id}`, { method: "DELETE" }));
  },
};

export const transportRouteService = {
  async list(params: { q?: string; status?: string } = {}): Promise<{ data: TransportRouteRecord[]; total: number }> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    return parseOrThrow(await fetch(`/api/transport-routes?${query.toString()}`));
  },
  async get(id: string): Promise<TransportRouteDetailRecord> {
    return parseOrThrow(await fetch(`/api/transport-routes/${id}`));
  },
  async create(input: TransportRouteInput): Promise<TransportRouteRecord> {
    return postJson("/api/transport-routes", input);
  },
  async update(id: string, input: Partial<TransportRouteInput>): Promise<TransportRouteRecord> {
    return postJson(`/api/transport-routes/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<void> {
    await parseOrThrow(await fetch(`/api/transport-routes/${id}`, { method: "DELETE" }));
  },
  async addStop(routeId: string, input: TransportRouteStopInput): Promise<TransportRouteStopRecord> {
    return postJson(`/api/transport-routes/${routeId}/stops`, input);
  },
  async updateStop(routeId: string, routeStopId: string, input: Partial<Pick<TransportRouteStopInput, "pickupTime" | "dropTime">>): Promise<TransportRouteStopRecord> {
    return postJson(`/api/transport-routes/${routeId}/stops/${routeStopId}`, input, "PATCH");
  },
  async removeStop(routeId: string, routeStopId: string): Promise<void> {
    await parseOrThrow(await fetch(`/api/transport-routes/${routeId}/stops/${routeStopId}`, { method: "DELETE" }));
  },
  async moveStop(routeId: string, routeStopId: string, direction: "up" | "down"): Promise<{ data: TransportRouteStopRecord[] }> {
    return postJson(`/api/transport-routes/${routeId}/stops/${routeStopId}/move`, { direction });
  },
  async assign(routeId: string, input: TransportRouteAssignmentInput): Promise<TransportRouteAssignmentRecord> {
    return postJson(`/api/transport-routes/${routeId}/assignment`, input);
  },
};

export const studentTransportService = {
  async list(
    params: { q?: string; routeId?: string; status?: string; page?: number; pageSize?: number } = {},
  ): Promise<{ data: StudentTransportRecord[]; total: number; page: number; pageSize: number }> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.routeId) query.set("routeId", params.routeId);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    return parseOrThrow(await fetch(`/api/transport-students?${query.toString()}`));
  },
  async get(id: string): Promise<StudentTransportRecord> {
    return parseOrThrow(await fetch(`/api/transport-students/${id}`));
  },
  async create(input: StudentTransportInput): Promise<StudentTransportRecord> {
    return postJson("/api/transport-students", input);
  },
  async update(id: string, input: Partial<StudentTransportInput>): Promise<StudentTransportRecord> {
    return postJson(`/api/transport-students/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<void> {
    await parseOrThrow(await fetch(`/api/transport-students/${id}`, { method: "DELETE" }));
  },
};

async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOrThrow<T>(response);
}
