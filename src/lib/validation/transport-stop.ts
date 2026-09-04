import { z } from "zod";
import { optionalNumber } from "@/lib/validation/shared";
import { STOP_STATUSES } from "@/lib/constants/transport";

const optionalString = (max: number) => z.string().trim().max(max).optional();

export const transportStopInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  code: optionalString(30),
  address: optionalString(255),
  landmark: optionalString(150),
  latitude: optionalNumber(z.coerce.number().min(-90).max(90)),
  longitude: optionalNumber(z.coerce.number().min(-180).max(180)),
  distanceFromSchool: optionalNumber(z.coerce.number().min(0).max(500)),
  status: z.enum(STOP_STATUSES).default("active"),
});

export type TransportStopInput = z.infer<typeof transportStopInputSchema>;
