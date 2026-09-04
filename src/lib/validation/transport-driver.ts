import { z } from "zod";
import { DRIVER_STATUSES } from "@/lib/constants/transport";

const optionalString = (max: number) => z.string().trim().max(max).optional();
/** Dates arrive as `yyyy-mm-dd` from a plain `<input type="date">` — parsed to a real Date in the route. */
const optionalDateString = z.string().trim().optional();

/**
 * A driver is either a school employee (`staffId` set — identity comes from
 * `Staff`) or a third-party vendor driver (`staffId` unset — `fullName`/
 * `phone` are then the identity). See TRANSPORT-ROADMAP.md §2.
 */
export const transportDriverBaseSchema = z.object({
  staffId: z.string().trim().min(1).optional(),
  fullName: optionalString(150),
  phone: optionalString(30),
  photoUrl: optionalString(500),
  address: optionalString(255),
  licenseNumber: optionalString(50),
  licenseType: optionalString(30),
  licenseIssueDate: optionalDateString,
  licenseExpiryDate: optionalDateString,
  policeVerificationDate: optionalDateString,
  medicalCertificateExpiryDate: optionalDateString,
  status: z.enum(DRIVER_STATUSES).default("active"),
});

export const transportDriverInputSchema = transportDriverBaseSchema.refine((data) => data.staffId || (data.fullName && data.phone), {
  message: "Select a staff member, or provide a name and phone for a vendor driver.",
  path: ["fullName"],
});

export type TransportDriverInput = z.infer<typeof transportDriverInputSchema>;
