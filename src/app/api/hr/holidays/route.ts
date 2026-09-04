import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { holidayInputSchema } from "@/lib/validation/hr-attendance";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { parseDay } from "@/lib/hr/work-calendar";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** The work calendar: holidays, vacations, and special working days. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("holidays", "view");
    const params = request.nextUrl.searchParams;

    const year = params.get("year") ? Number(params.get("year")) : undefined;
    const from = params.get("from");
    const to = params.get("to");

    const range =
      from || to
        ? { startDate: { lte: to ? parseDay(to) : new Date(8640000000000000) }, endDate: { gte: from ? parseDay(from) : new Date(0) } }
        : year
          ? {
              startDate: { lte: new Date(Date.UTC(year, 11, 31)) },
              endDate: { gte: new Date(Date.UTC(year, 0, 1)) },
            }
          : {};

    const data = await prisma.holiday.findMany({
      where: { schoolId, ...range },
      include: { campus: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("holidays", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(holidayInputSchema.parse(await request.json()));

    const startDate = parseDay(input.startDate);
    // A single-day holiday ends the day it starts, which keeps every range
    // query inclusive without a null case to handle.
    const endDate = input.endDate ? parseDay(input.endDate) : startDate;

    if (input.campusId) {
      const campus = await prisma.campus.findFirst({ where: { id: input.campusId, schoolId }, select: { id: true } });
      if (!campus) return NextResponse.json({ error: "That campus doesn't exist." }, { status: 422 });
    }

    const holiday = await prisma.$transaction(async (tx) => {
      const row = await tx.holiday.create({
        data: {
          schoolId,
          name: input.name,
          startDate,
          endDate,
          // No schema default reaches a partial parse, so these are explicit.
          holidayType: input.holidayType ?? "school",
          appliesTo: input.appliesTo ?? "all",
          campusId: input.campusId,
          isWorkingDay: input.isWorkingDay ?? false,
          description: input.description,
          createdById: user.id,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "hr.holiday.create",
        entityType: "Holiday",
        entityId: row.id,
        after: { name: row.name, from: input.startDate, to: input.endDate ?? input.startDate, type: row.holidayType },
      });

      return row;
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

