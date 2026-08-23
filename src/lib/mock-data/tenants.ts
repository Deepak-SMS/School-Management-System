import type { School } from "@/types/tenant";

/**
 * Realistic sample tenant data for local development and design review.
 * Replace with `tenantService` API calls once the backend exists — see
 * src/services/tenantService.ts for the swap-in point.
 */
export const mockSchools: School[] = [
  {
    id: "sch_green-valley",
    name: "Green Valley International School",
    shortName: "Green Valley",
    logoInitials: "GV",
    campuses: [
      { id: "cmp_main", name: "Main Campus", city: "Pune", isPrimary: true },
      { id: "cmp_north", name: "North Campus", city: "Pune" },
      { id: "cmp_riverside", name: "Riverside Campus", city: "Lonavala" },
    ],
    academicYears: [
      { id: "ay_2026_27", label: "2026–27", startDate: "2026-06-01", endDate: "2027-04-30", isCurrent: true },
      { id: "ay_2025_26", label: "2025–26", startDate: "2025-06-01", endDate: "2026-04-30" },
    ],
  },
  {
    id: "sch_sunrise-public",
    name: "Sunrise Public School",
    shortName: "Sunrise Public",
    logoInitials: "SP",
    campuses: [{ id: "cmp_main", name: "Main Campus", city: "Nagpur", isPrimary: true }],
    academicYears: [
      { id: "ay_2026_27", label: "2026–27", startDate: "2026-06-01", endDate: "2027-04-30", isCurrent: true },
    ],
  },
  {
    id: "sch_delhi-public-academy",
    name: "Delhi Public Academy",
    shortName: "DP Academy",
    logoInitials: "DA",
    campuses: [
      { id: "cmp_main", name: "Main Campus", city: "New Delhi", isPrimary: true },
      { id: "cmp_dwarka", name: "Dwarka Campus", city: "New Delhi" },
    ],
    academicYears: [
      { id: "ay_2026_27", label: "2026–27", startDate: "2026-06-01", endDate: "2027-04-30", isCurrent: true },
      { id: "ay_2025_26", label: "2025–26", startDate: "2025-06-01", endDate: "2026-04-30" },
    ],
  },
];
