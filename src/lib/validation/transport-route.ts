import { z } from "zod";
import { optionalNumber } from "@/lib/validation/shared";
import { ROUTE_STATUSES } from "@/lib/constants/transport";

const optionalString = (max: number) => z.string().trim().max(max).optional();

export const transportRouteInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  routeNumber: optionalString(30),
  startingPoint: optionalString(150),
  destination: optionalString(150),
  totalDistanceKm: optionalNumber(z.coerce.number().min(0).max(2000)),
  estimatedDurationMinutes: optionalNumber(z.coerce.number().int().min(0).max(600)),
  morningTiming: optionalString(30),
  afternoonTiming: optionalString(30),
  status: z.enum(ROUTE_STATUSES).default("active"),
});

export type TransportRouteInput = z.infer<typeof transportRouteInputSchema>;

/** Adds one stop to a route's ordered list — appended at the end unless a position is given. */
export const transportRouteStopInputSchema = z.object({
  stopId: z.string().trim().min(1, "Choose a stop"),
  pickupTime: optionalString(20),
  dropTime: optionalString(20),
});

export type TransportRouteStopInput = z.infer<typeof transportRouteStopInputSchema>;

/** Moves one stop up or down one position, swapping sequence order with its neighbor. */
export const transportRouteStopMoveSchema = z.object({
  direction: z.enum(["up", "down"]),
});

/** Assigns (or reassigns) the vehicle + driver for a route, closing out whichever assignment was previously current. */
export const transportRouteAssignmentInputSchema = z.object({
  vehicleId: z.string().trim().min(1, "Choose a vehicle"),
  driverId: z.string().trim().min(1, "Choose a driver"),
  startDate: z.string().trim().min(1, "Start date is required"),
  note: optionalString(255),
});

export type TransportRouteAssignmentInput = z.infer<typeof transportRouteAssignmentInputSchema>;
