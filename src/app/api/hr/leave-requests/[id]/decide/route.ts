import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { leaveDecisionSchema } from "@/lib/validation/hr-attendance";
import { decideLeave, LeaveError } from "@/lib/hr/leave";
import { apiError } from "@/lib/api-error";

/**
 * Approves or rejects a leave request.
 *
 * Approving writes the attendance for every working day it covers — see
 * src/lib/hr/leave.ts. Needs `staffLeave:approve`, which the employee applying
 * does not hold.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("staffLeave", "approve");
    const { id } = await params;
    const body = leaveDecisionSchema.parse(await request.json());

    const updated = await decideLeave(user, id, body.decision, body.note);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof LeaveError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
