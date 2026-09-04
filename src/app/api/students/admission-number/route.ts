import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { isAdmissionNumberTaken, suggestAdmissionNumber } from "@/lib/students/admission-number";
import { apiError } from "@/lib/api-error";

/**
 * `?value=X` checks whether that admission number is already taken (add `excludeId`
 * when checking against an existing student's own number during an edit).
 * With no `value`, suggests a fresh, unused one for the "Add student" form.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("students", "view");
    const value = request.nextUrl.searchParams.get("value");

    if (value !== null) {
      const excludeId = request.nextUrl.searchParams.get("excludeId") ?? undefined;
      const taken = await isAdmissionNumberTaken(schoolId, value.trim(), excludeId);
      return NextResponse.json({ available: !taken });
    }

    const suggested = await suggestAdmissionNumber(schoolId);
    return NextResponse.json({ suggested });
  } catch (error) {
    return apiError(error);
  }
}
