import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { teacherAvailabilityInputSchema } from "@/lib/validation/timetable";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "view");
    const { id } = await params;
    const staff = await prisma.staff.findFirst({
      where: { id, schoolId },
      select: { id: true, fullName: true, maxPeriodsPerDay: true, maxConsecutivePeriods: true },
    });
    if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    const unavailability = await prisma.teacherUnavailability.findMany({ where: { staffId: id, schoolId } });
    return NextResponse.json({ ...staff, unavailability });
  } catch (error) {
    return apiError(error);
  }
}

/** Replaces the full unavailability list in one transaction — a teacher's weekly blackout grid is small, hand-edited configuration. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "edit");
    const { id } = await params;
    const body = await request.json();
    const input = teacherAvailabilityInputSchema.parse(body);

    const staff = await prisma.staff.findFirst({ where: { id, schoolId } });
    if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id },
        data: { maxPeriodsPerDay: input.maxPeriodsPerDay ?? null, maxConsecutivePeriods: input.maxConsecutivePeriods ?? null },
      });
      await tx.teacherUnavailability.deleteMany({ where: { staffId: id } });
      if (input.unavailability.length > 0) {
        await tx.teacherUnavailability.createMany({
          data: input.unavailability.map((u) => ({ schoolId, staffId: id, dayOfWeek: u.dayOfWeek, periodId: u.periodId })),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
