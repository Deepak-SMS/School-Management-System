import { z } from "zod";
import { STUDENT_TRANSPORT_DIRECTIONS, STUDENT_TRANSPORT_STATUSES } from "@/lib/constants/transport";

export const studentTransportInputSchema = z.object({
  studentId: z.string().trim().min(1, "Choose a student"),
  routeId: z.string().trim().min(1, "Choose a route"),
  pickupStopId: z.string().trim().min(1, "Choose a pickup stop"),
  dropStopId: z.string().trim().min(1).optional(),
  direction: z.enum(STUDENT_TRANSPORT_DIRECTIONS).default("two_way"),
  startDate: z.string().trim().min(1, "Start date is required"),
  endDate: z.string().trim().optional(),
  status: z.enum(STUDENT_TRANSPORT_STATUSES).default("active"),
});

export type StudentTransportInput = z.infer<typeof studentTransportInputSchema>;
