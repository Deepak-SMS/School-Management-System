import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { timetableInputSchema } from "@/lib/validation/timetable";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const { schoolId } = await requirePermission("timetable", "view");
    const timetables = await prisma.timetable.findMany({
      where: { schoolId },
      include: {
        academicYear: { select: { id: true, label: true } },
        timingSet: { select: { id: true, name: true } },
        _count: { select: { classes: true, slots: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: timetables });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("timetable", "create");
    const body = await request.json();
    const input = timetableInputSchema.parse(body);

    const timingSet = await prisma.timingSet.findFirst({ where: { id: input.timingSetId, schoolId } });
    if (!timingSet) {
      return NextResponse.json({ error: "Validation failed", fieldErrors: { timingSetId: ["Timing set not found."] } }, { status: 422 });
    }

    const timetable = await prisma.$transaction(async (tx) => {
      const created = await tx.timetable.create({
        data: {
          schoolId,
          academicYearId: input.academicYearId,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          timingSetId: input.timingSetId,
          workingDaysJson: JSON.stringify(input.workingDays),
          status: "draft",
        },
      });
      await tx.timetableClass.createMany({
        data: input.classes.map((c) => ({ timetableId: created.id, classId: c.classId, sectionId: c.sectionId ?? null })),
      });
      return created;
    });

    return NextResponse.json(timetable, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
