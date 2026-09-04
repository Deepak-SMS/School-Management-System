import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { leaveTypeInputSchema } from "@/lib/validation/hr-attendance";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { DEFAULT_LEAVE_TYPES } from "@/lib/constants/hr-attendance";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * The leave types a school offers.
 *
 * A school with none yet gets the standard Indian set seeded on first read, so
 * an employee can apply for leave on day one instead of meeting an empty
 * dropdown with no way past it. It fires only when the count is zero.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("staffLeave", "view");
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

    if ((await prisma.leaveType.count({ where: { schoolId } })) === 0) {
      await prisma.leaveType.createMany({
        data: DEFAULT_LEAVE_TYPES.map((t, index) => ({
          schoolId,
          name: t.name,
          code: t.code,
          isPaid: t.isPaid,
          annualQuota: t.annualQuota,
          carryForward: t.carryForward,
          maxCarryForward: "maxCarryForward" in t ? t.maxCarryForward : null,
          requiresDocument: "requiresDocument" in t ? t.requiresDocument : false,
          sortOrder: index,
          status: "active",
        })),
      });
    }

    const data = await prisma.leaveType.findMany({
      where: { schoolId, ...(includeInactive ? {} : { status: "active" }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("staffLeave", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(leaveTypeInputSchema.parse(await request.json()));

    const leaveType = await prisma.$transaction(async (tx) => {
      const row = await tx.leaveType.create({
        data: {
          schoolId,
          name: input.name,
          code: input.code.toUpperCase(),
          // Explicit rather than relying on schema defaults, which a partial
          // parse would never reach.
          isPaid: input.isPaid ?? true,
          annualQuota: input.annualQuota ?? null,
          carryForward: input.carryForward ?? false,
          maxCarryForward: input.maxCarryForward ?? null,
          requiresDocument: input.requiresDocument ?? false,
          appliesTo: input.appliesTo ?? "all",
          allowHalfDay: input.allowHalfDay ?? true,
          sortOrder: input.sortOrder ?? 0,
          status: input.status ?? "active",
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "hr.leaveType.create",
        entityType: "LeaveType",
        entityId: row.id,
        after: { name: row.name, code: row.code, isPaid: row.isPaid, quota: row.annualQuota },
      });

      return row;
    });

    return NextResponse.json(leaveType, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
