import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { roomInputSchema } from "@/lib/validation/timetable";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "edit");
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(roomInputSchema.partial().parse(body));

    const existing = await prisma.room.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Room not found." }, { status: 404 });

    const { allowedSubjectIds, ...rest } = input;
    const room = await prisma.room.update({
      where: { id },
      data: {
        ...rest,
        ...(allowedSubjectIds !== undefined && {
          allowedSubjectIdsJson: allowedSubjectIds.length > 0 ? JSON.stringify(allowedSubjectIds) : null,
        }),
      },
    });

    return NextResponse.json(room);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "delete");
    const { id } = await params;
    const existing = await prisma.room.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Room not found." }, { status: 404 });

    const usedInSlots = await prisma.timetableSlot.count({ where: { roomId: id } });
    if (usedInSlots > 0) {
      return NextResponse.json(
        { error: "This room is used in a timetable. Deactivate it instead of deleting." },
        { status: 409 },
      );
    }

    await prisma.room.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
