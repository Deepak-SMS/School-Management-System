import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { RequestUser } from "@/lib/current-user";
import { recordAudit } from "@/lib/audit";
import { AttendanceError, assertPeriodOpen } from "@/lib/hr/staff-attendance";
import { dayKey, describeDay, eachDay, loadCalendar, staffGroup } from "@/lib/hr/work-calendar";

/**
 * Leave: what it costs, and what approving it does.
 *
 * The important part is that approving a request writes the attendance for
 * every working day it covers. Leave and attendance are then one record rather
 * than two lists someone reconciles by hand at payroll time — which is where
 * the discrepancies that cost people money come from.
 */

export class LeaveError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "LeaveError";
    this.status = status;
  }
}

/**
 * How many days a request actually consumes.
 *
 * Holidays and weekly offs inside the range are free — an employee taking
 * Friday to Monday over a closed Sunday spends three days, not four. A half-day
 * request is only meaningful on a single day.
 */
export async function computeLeaveDays(
  schoolId: string,
  staffId: string,
  startDate: Date,
  endDate: Date,
  halfDay: string,
): Promise<{ days: number; workingDates: Date[] }> {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, schoolId },
    select: { category: true, campusId: true },
  });
  if (!staff) throw new LeaveError("Employee not found.", 404);

  const calendar = await loadCalendar(prisma, schoolId, startDate, endDate);
  const scope = { group: staffGroup(staff.category), campusId: staff.campusId };

  const workingDates = eachDay(startDate, endDate).filter((d) => describeDay(d, calendar, scope).isWorkingDay);

  if (workingDates.length === 0) {
    throw new LeaveError("Those dates are all holidays or weekly offs — there's no leave to take.", 422);
  }

  const isSingleDay = dayKey(startDate).getTime() === dayKey(endDate).getTime();
  if (halfDay !== "none" && !isSingleDay) {
    throw new LeaveError("A half day can only be applied to a single date.", 422);
  }

  return { days: halfDay !== "none" ? 0.5 : workingDates.length, workingDates };
}

/** The year a request belongs to, for balance purposes: the year it starts in. */
function balanceYear(startDate: Date): number {
  return dayKey(startDate).getUTCFullYear();
}

/**
 * Ensures a balance row exists, seeded from the leave type's annual quota.
 *
 * Created on demand rather than provisioned for every employee × type × year up
 * front, which would be thousands of rows most of which stay at zero.
 */
export async function ensureBalance(
  tx: Prisma.TransactionClient,
  schoolId: string,
  staffId: string,
  leaveTypeId: string,
  year: number,
) {
  const existing = await tx.leaveBalance.findUnique({
    where: { staffId_leaveTypeId_year: { staffId, leaveTypeId, year } },
  });
  if (existing) return existing;

  const type = await tx.leaveType.findFirst({ where: { id: leaveTypeId, schoolId }, select: { annualQuota: true } });

  return tx.leaveBalance.create({
    data: { schoolId, staffId, leaveTypeId, year, entitled: type?.annualQuota ?? 0 },
  });
}

export interface ApplyLeaveInput {
  staffId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  halfDay?: string;
  reason: string;
  contactDuringLeave?: string;
  documentFileId?: string;
}

export async function applyForLeave(user: RequestUser, input: ApplyLeaveInput) {
  const { schoolId } = user;
  const startDate = dayKey(new Date(input.startDate));
  const endDate = dayKey(new Date(input.endDate));

  if (endDate < startDate) throw new LeaveError("The end date is before the start date.", 422);

  const leaveType = await prisma.leaveType.findFirst({ where: { id: input.leaveTypeId, schoolId } });
  if (!leaveType) throw new LeaveError("That leave type doesn't exist.", 404);
  if (leaveType.status !== "active") throw new LeaveError(`"${leaveType.name}" is no longer offered.`, 422);

  const halfDay = input.halfDay ?? "none";
  if (halfDay !== "none" && !leaveType.allowHalfDay) {
    throw new LeaveError(`"${leaveType.name}" can't be taken as a half day.`, 422);
  }
  if (leaveType.requiresDocument && !input.documentFileId) {
    throw new LeaveError(`"${leaveType.name}" needs a supporting document attached.`, 422);
  }

  const { days } = await computeLeaveDays(schoolId, input.staffId, startDate, endDate, halfDay);

  // Two open requests must not be able to spend the same entitlement, so the
  // check counts what is already pending as well as what is used.
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      staffId: input.staffId,
      status: { in: ["pending", "approved"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true, startDate: true, endDate: true },
  });
  if (overlapping) {
    throw new LeaveError("There's already a leave request covering some of those dates.", 409);
  }

  const year = balanceYear(startDate);

  return prisma.$transaction(async (tx) => {
    const balance = await ensureBalance(tx, schoolId, input.staffId, input.leaveTypeId, year);

    // A null quota means uncapped — typically unpaid leave, which nobody should
    // be blocked from taking.
    if (leaveType.annualQuota !== null) {
      const available = balance.entitled + balance.carriedForward - balance.used - balance.pending;
      if (days > available) {
        throw new LeaveError(
          `Only ${available} day${available === 1 ? "" : "s"} of ${leaveType.name} remain, but this request is for ${days}.`,
          422,
        );
      }
    }

    const request = await tx.leaveRequest.create({
      data: {
        schoolId,
        staffId: input.staffId,
        leaveTypeId: input.leaveTypeId,
        startDate,
        endDate,
        halfDay,
        days,
        reason: input.reason,
        contactDuringLeave: input.contactDuringLeave,
        documentFileId: input.documentFileId,
        status: "pending",
      },
    });

    await tx.leaveBalance.update({
      where: { id: balance.id },
      data: { pending: { increment: days } },
    });

    await recordAudit(tx, {
      schoolId,
      userId: user.id,
      action: "hr.leave.apply",
      entityType: "LeaveRequest",
      entityId: request.id,
      after: { staffId: input.staffId, type: leaveType.code, days, from: input.startDate, to: input.endDate },
    });

    return request;
  });
}

/**
 * Approves a request and writes the attendance behind it.
 *
 * The attendance rows are marked `source: "leave"`, which is what stops HR
 * later overwriting them by hand and leaving the leave record claiming
 * something the attendance no longer says.
 */
export async function decideLeave(
  user: RequestUser,
  requestId: string,
  decision: "approved" | "rejected",
  note?: string,
) {
  const { schoolId } = user;

  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, schoolId },
    include: { leaveType: true, staff: { select: { category: true, campusId: true } } },
  });
  if (!request) throw new LeaveError("Leave request not found.", 404);
  if (request.status !== "pending") {
    throw new LeaveError(`This request has already been ${request.status}.`, 409);
  }
  if (decision === "rejected" && (note ?? "").trim().length < 5) {
    throw new LeaveError("Say why the request is being rejected — it goes back to the employee.", 422);
  }

  // Refuse before writing anything if any day falls in a closed month.
  if (decision === "approved") {
    await assertPeriodOpen(prisma, schoolId, request.startDate);
    await assertPeriodOpen(prisma, schoolId, request.endDate);
  }

  const year = balanceYear(request.startDate);
  const status = request.leaveType.isPaid ? "paid_leave" : "unpaid_leave";

  const calendar = await loadCalendar(prisma, schoolId, request.startDate, request.endDate);
  const scope = { group: staffGroup(request.staff.category), campusId: request.staff.campusId };
  const workingDates = eachDay(request.startDate, request.endDate).filter(
    (d) => describeDay(d, calendar, scope).isWorkingDay,
  );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: decision, reviewedById: user.id, reviewedAt: new Date(), reviewNote: note },
    });

    const balance = await ensureBalance(tx, schoolId, request.staffId, request.leaveTypeId, year);

    if (decision === "approved") {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: { decrement: request.days }, used: { increment: request.days } },
      });

      for (const date of workingDates) {
        await tx.staffAttendance.upsert({
          where: { staffId_date: { staffId: request.staffId, date } },
          create: {
            schoolId,
            staffId: request.staffId,
            date,
            status,
            source: "leave",
            leaveRequestId: requestId,
            markedById: user.id,
            remarks: `${request.leaveType.name}${request.halfDay !== "none" ? " (half day)" : ""}`,
          },
          update: {
            status,
            source: "leave",
            leaveRequestId: requestId,
            remarks: `${request.leaveType.name}${request.halfDay !== "none" ? " (half day)" : ""}`,
          },
        });
      }
    } else {
      // Rejected: the days go back, nothing is written to attendance.
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: { decrement: request.days } },
      });
    }

    await recordAudit(tx, {
      schoolId,
      userId: user.id,
      action: `hr.leave.${decision}`,
      entityType: "LeaveRequest",
      entityId: requestId,
      before: { status: "pending" },
      after: { status: decision, note, attendanceDaysWritten: decision === "approved" ? workingDates.length : 0 },
    });

    return updated;
  });
}

/**
 * Cancels a request, removing any attendance it wrote.
 *
 * An approved leave that is cancelled has to take its attendance rows with it,
 * or the employee stays marked on leave for days they actually worked.
 */
export async function cancelLeave(user: RequestUser, requestId: string, reason: string) {
  const { schoolId } = user;

  const request = await prisma.leaveRequest.findFirst({ where: { id: requestId, schoolId } });
  if (!request) throw new LeaveError("Leave request not found.", 404);
  if (request.status === "cancelled") throw new LeaveError("This request is already cancelled.", 409);
  if (request.status === "rejected") throw new LeaveError("A rejected request doesn't need cancelling.", 409);

  if (request.status === "approved") {
    await assertPeriodOpen(prisma, schoolId, request.startDate).catch((e) => {
      if (e instanceof AttendanceError) {
        throw new LeaveError(
          "This leave falls in a locked attendance month. Reopen the month before cancelling it.",
          409,
        );
      }
      throw e;
    });
  }

  const year = balanceYear(request.startDate);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason },
    });

    const balance = await ensureBalance(tx, schoolId, request.staffId, request.leaveTypeId, year);
    await tx.leaveBalance.update({
      where: { id: balance.id },
      data:
        request.status === "approved"
          ? { used: { decrement: request.days } }
          : { pending: { decrement: request.days } },
    });

    const removed = await tx.staffAttendance.deleteMany({ where: { leaveRequestId: requestId } });

    await recordAudit(tx, {
      schoolId,
      userId: user.id,
      action: "hr.leave.cancel",
      entityType: "LeaveRequest",
      entityId: requestId,
      before: { status: request.status },
      after: { status: "cancelled", reason, attendanceRowsRemoved: removed.count },
    });

    return updated;
  });
}

/** An employee's balances for a year, seeded from the active leave types. */
export async function leaveBalances(schoolId: string, staffId: string, year: number) {
  const types = await prisma.leaveType.findMany({
    where: { schoolId, status: "active" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const balances = await prisma.leaveBalance.findMany({ where: { schoolId, staffId, year } });
  const byType = new Map(balances.map((b) => [b.leaveTypeId, b]));

  return types.map((t) => {
    const b = byType.get(t.id);
    const entitled = b?.entitled ?? t.annualQuota ?? 0;
    const carriedForward = b?.carriedForward ?? 0;
    const used = b?.used ?? 0;
    const pending = b?.pending ?? 0;
    return {
      leaveTypeId: t.id,
      name: t.name,
      code: t.code,
      isPaid: t.isPaid,
      // Null quota is uncapped; there is no meaningful "available" figure.
      unlimited: t.annualQuota === null,
      entitled,
      carriedForward,
      used,
      pending,
      available: t.annualQuota === null ? null : entitled + carriedForward - used - pending,
    };
  });
}
