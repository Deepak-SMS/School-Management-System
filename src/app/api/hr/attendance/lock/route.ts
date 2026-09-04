import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { periodLockSchema } from "@/lib/validation/hr-attendance";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Closing a month's attendance, and reopening one.
 *
 * Locking is routine. Reopening is not: it changes figures payroll may already
 * have run against, so it needs a reason, a stronger permission, and it leaves
 * the original lock on the record rather than deleting it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = periodLockSchema.parse(await request.json());

    // Reopening is the privileged half — see the note above.
    const user = await requirePermission("employeeAttendance", body.action === "lock" ? "approve" : "delete");
    const { schoolId } = user;
    const { year, month } = body;

    const existing = await prisma.attendancePeriodLock.findUnique({
      where: { schoolId_year_month: { schoolId, year, month } },
    });

    if (body.action === "lock") {
      if (existing?.isLocked) {
        return NextResponse.json({ error: "That month is already locked." }, { status: 409 });
      }

      const lock = await prisma.$transaction(async (tx) => {
        const row = await tx.attendancePeriodLock.upsert({
          where: { schoolId_year_month: { schoolId, year, month } },
          create: { schoolId, year, month, isLocked: true, lockedById: user.id },
          update: { isLocked: true, lockedById: user.id, lockedAt: new Date(), reopenedAt: null, reopenReason: null },
        });

        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "hr.attendance.lock",
          entityType: "AttendancePeriodLock",
          entityId: row.id,
          after: { year, month },
        });

        return row;
      });

      return NextResponse.json(lock);
    }

    // Reopen
    if (!existing || !existing.isLocked) {
      return NextResponse.json({ error: "That month isn't locked." }, { status: 409 });
    }
    if ((body.reason ?? "").trim().length < 5) {
      return NextResponse.json(
        {
          error: "Reopening a locked month needs a reason — payroll may already have used these figures.",
          fieldErrors: { reason: ["Give a reason of at least 5 characters"] },
        },
        { status: 422 },
      );
    }

    const reopened = await prisma.$transaction(async (tx) => {
      const row = await tx.attendancePeriodLock.update({
        where: { id: existing.id },
        data: { isLocked: false, reopenedById: user.id, reopenedAt: new Date(), reopenReason: body.reason },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "hr.attendance.reopen",
        entityType: "AttendancePeriodLock",
        entityId: row.id,
        before: { isLocked: true, lockedAt: existing.lockedAt },
        after: { isLocked: false, reason: body.reason },
      });

      return row;
    });

    return NextResponse.json(reopened);
  } catch (error) {
    return apiError(error);
  }
}
