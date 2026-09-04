import { z } from "zod";
import { optionalNumber } from "@/lib/validation/shared";
import { VEHICLE_TYPES, FUEL_TYPES, VEHICLE_STATUSES } from "@/lib/constants/transport";

const optionalString = (max: number) => z.string().trim().max(max).optional();

export const transportVehicleInputSchema = z.object({
  vehicleNumber: z.string().trim().min(1, "Vehicle number is required").max(30),
  vehicleType: z.enum(VEHICLE_TYPES).default("bus"),
  make: optionalString(100),
  modelName: optionalString(100),
  manufacturingYear: optionalNumber(z.coerce.number().int().min(1980).max(2100)),
  seatingCapacity: optionalNumber(z.coerce.number().int().min(1).max(200)),
  standingCapacity: optionalNumber(z.coerce.number().int().min(0).max(200)),
  fuelType: z.enum(FUEL_TYPES).optional(),
  color: optionalString(30),
  gpsDeviceId: optionalString(100),
  status: z.enum(VEHICLE_STATUSES).default("active"),
});

export type TransportVehicleInput = z.infer<typeof transportVehicleInputSchema>;
