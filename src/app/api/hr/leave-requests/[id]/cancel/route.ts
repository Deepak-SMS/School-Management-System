import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { leaveCancelSchema } from "@/lib/validation/hr-attendance";
import { cancelLeave, LeaveError } from "@/lib/hr/leave";
import { apiError } from "@/lib/api-error";

/**
 * Cancels a leave request, removing any attendance it wrote.
 *
 * An employee may cancel their own; cancelling someone else's is an HR action.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("staffLeave", "view");
    const { id } = await params;
    const body = leaveCancelSchema.parse(await request.json());

    const existing = await prisma.leaveRequest.findFirst({
      where: { id, schoolId: user.schoolId },
      select: { staffId: true },
    });
    if (!existing) return NextResponse.json({ error: "Leave request not found." }, { status: 404 });

    const self = await prisma.staff.findFirst({
      where: { schoolId: user.schoolId, userId: user.id },
      select: { id: true },
    });

    if (existing.staffId !== self?.id) {
      await requirePermission("staffLeave", "approve");
    }

    const updated = await cancelLeave(user, id, body.reason);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof LeaveError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
