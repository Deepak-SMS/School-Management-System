import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { getCurrentStaff, getTeacherScope } from "@/lib/teacher-scope";
import { apiError } from "@/lib/api-error";

/** What the signed-in teacher may see: sections they're class teacher of, and the class/section/subject combinations they teach. */
export async function GET() {
  try {
    const user = await requirePermission("studentAttendance", "view");
    const staff = await getCurrentStaff();
    const scope = await getTeacherScope(staff.id, user.schoolId);
    return NextResponse.json(scope);
  } catch (error) {
    return apiError(error);
  }
}
