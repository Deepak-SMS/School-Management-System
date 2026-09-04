import { ForbiddenError } from "@/lib/authorize";
import { getCurrentStaff, getTeacherScope, canMarkHomeroom } from "@/lib/teacher-scope";
import type { RequestUser } from "@/lib/current-user";

/**
 * Row-level restriction on top of the coarse `whatsappCampaigns` grant — same
 * pattern src/lib/teacher-scope.ts already applies to studentAttendance/
 * examMarks. Not expressible in the ROLE_PERMISSIONS matrix because it
 * depends on the specific audienceMode/class/section chosen, not just the role.
 */
export async function assertAudienceAllowedForUser(
  user: RequestUser,
  audienceMode: string,
  classId: string | undefined,
  sectionId: string | undefined,
): Promise<void> {
  if (user.role === "teacher") {
    if (audienceMode !== "class_parents" || !classId || !sectionId) {
      throw new ForbiddenError("whatsappCampaigns", "create");
    }
    const staff = await getCurrentStaff();
    const scope = await getTeacherScope(staff.id, user.schoolId);
    if (!canMarkHomeroom(scope, classId, sectionId)) {
      throw new ForbiddenError("whatsappCampaigns", "create");
    }
    return;
  }

  if (user.role === "accountant" && audienceMode !== "fee_defaulters") {
    throw new ForbiddenError("whatsappCampaigns", "create");
  }
}
