/**
 * Single source of truth for every "enum-like" string field on the Transport
 * module (see TRANSPORT-ROADMAP.md). SQLite has no native enum type (see
 * prisma/schema.prisma), so these arrays back both the Zod validation
 * schemas and the UI <Select> options.
 */

export const VEHICLE_TYPES = ["bus", "van", "car", "other"] as const;

export const VEHICLE_TYPE_LABELS: Record<(typeof VEHICLE_TYPES)[number], string> = {
  bus: "Bus",
  van: "Van",
  car: "Car",
  other: "Other",
};

export const FUEL_TYPES = ["diesel", "petrol", "cng", "electric", "other"] as const;

export const FUEL_TYPE_LABELS: Record<(typeof FUEL_TYPES)[number], string> = {
  diesel: "Diesel",
  petrol: "Petrol",
  cng: "CNG",
  electric: "Electric",
  other: "Other",
};

/// Active: in the fleet and roadworthy. In Service: currently assigned to a route (later phase).
/// Maintenance: temporarily off the road. Inactive: parked, not in current use. Retired: permanently decommissioned.
export const VEHICLE_STATUSES = ["active", "in_service", "maintenance", "inactive", "retired"] as const;

export const VEHICLE_STATUS_LABELS: Record<(typeof VEHICLE_STATUSES)[number], string> = {
  active: "Active",
  in_service: "In Service",
  maintenance: "Maintenance",
  inactive: "Inactive",
  retired: "Retired",
};

export const DRIVER_STATUSES = ["active", "inactive", "on_leave"] as const;

export const DRIVER_STATUS_LABELS: Record<(typeof DRIVER_STATUSES)[number], string> = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On Leave",
};

export const STOP_STATUSES = ["active", "inactive"] as const;

export const STOP_STATUS_LABELS: Record<(typeof STOP_STATUSES)[number], string> = {
  active: "Active",
  inactive: "Inactive",
};

export const ROUTE_STATUSES = ["active", "inactive"] as const;

export const ROUTE_STATUS_LABELS: Record<(typeof ROUTE_STATUSES)[number], string> = {
  active: "Active",
  inactive: "Inactive",
};

export const STUDENT_TRANSPORT_DIRECTIONS = ["one_way", "two_way"] as const;

export const STUDENT_TRANSPORT_DIRECTION_LABELS: Record<(typeof STUDENT_TRANSPORT_DIRECTIONS)[number], string> = {
  one_way: "One Way",
  two_way: "Two Way",
};

export const STUDENT_TRANSPORT_STATUSES = ["active", "inactive"] as const;

export const STUDENT_TRANSPORT_STATUS_LABELS: Record<(typeof STUDENT_TRANSPORT_STATUSES)[number], string> = {
  active: "Active",
  inactive: "Inactive",
};
