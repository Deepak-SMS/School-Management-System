import type { CurrentUser } from "@/types/user";

/**
 * Mock signed-in user. Replace with the authenticated session once auth exists —
 * see src/services/authService.ts (added when Phase 3+ needs real auth flows).
 */
export const mockCurrentUser: CurrentUser = {
  id: "usr_1",
  name: "Aditi Rao",
  email: "aditi.rao@greenvalley.edu",
  avatarInitials: "AR",
  role: "school_admin",
  roleLabel: "School Admin",
  schoolIds: ["sch_green-valley", "sch_sunrise-public", "sch_delhi-public-academy"],
};
