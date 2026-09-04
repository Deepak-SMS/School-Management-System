import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { timetableSlotInputSchema } from "@/lib/validation/timetable";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { assertSlotIsValid } from "@/lib/timetable/validate-slot";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const SLOT_INCLUDE = {
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, fullName: true } },
  room: { select: { id: true, name: true } },
  section: { select: { id: true, name: true, classId: true } },
  period: { select: { id: true, label: true, startTime: true, endTime: true, sortOrder: true } },
} satisfies Prisma.TimetableSlotInclude;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("timetable", "view");
    const { id: timetableId } = await params;
    const query = request.nextUrl.searchParams;
    const sectionId = query.get("sectionId") ?? undefined;
    const teacherId = query.get("teacherId") ?? undefined;
    const roomId = query.get("roomId") ?? undefined;

    const slots = await prisma.timetableSlot.findMany({
      where: { timetableId, ...(sectionId && { sectionId }), ...(teacherId && { teacherId }), ...(roomId && { roomId }) },
      include: SLOT_INCLUDE,
    });

    return NextResponse.json({ data: slots });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "edit");
    const { id: timetableId } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(timetableSlotInputSchema.parse(body));

    const validation = await assertSlotIsValid({
      timetableId,
      sectionId: input.sectionId,
      dayOfWeek: input.dayOfWeek,
      periodId: input.periodId,
      teacherId: input.teacherId ?? null,
      roomId: input.roomId ?? null,
    });
    if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 409 });

    const slot = await prisma.timetableSlot.create({
      data: {
        schoolId,
        timetableId,
        sectionId: input.sectionId,
        dayOfWeek: input.dayOfWeek,
        periodId: input.periodId,
        subjectId: input.subjectId,
        teacherId: input.teacherId ?? null,
        roomId: input.roomId ?? null,
        source: "manual",
      },
      include: SLOT_INCLUDE,
    });

    return NextResponse.json(slot, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
