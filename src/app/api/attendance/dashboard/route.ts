import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { getAttendanceOverview } from "@/lib/attendance-dashboard";
import { apiError } from "@/lib/api-error";

/** Same aggregation the general `/admin` Dashboard uses, widened to every active class — including ones nobody has marked yet today. */
export async function GET() {
  try {
    const { schoolId } = await requirePermission("studentAttendance", "view");
    const overview = await getAttendanceOverview(schoolId, { includeUnmarkedClasses: true });
    return NextResponse.json(overview);
  } catch (error) {
    return apiError(error);
  }
}
