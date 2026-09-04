import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { roomInputSchema } from "@/lib/validation/timetable";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const { schoolId } = await requirePermission("timetable", "view");
    const rooms = await prisma.room.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
    const data = rooms.map((r) => ({
      ...r,
      allowedSubjectIds: r.allowedSubjectIdsJson ? JSON.parse(r.allowedSubjectIdsJson) : null,
    }));
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("timetable", "create");
    const body = await request.json();
    const input = cleanEmptyStrings(roomInputSchema.parse(body));

    const room = await prisma.room.create({
      data: {
        schoolId,
        name: input.name,
        campusId: input.campusId,
        buildingName: input.buildingName,
        floor: input.floor,
        capacity: input.capacity,
        roomType: input.roomType,
        allowedSubjectIdsJson: input.allowedSubjectIds && input.allowedSubjectIds.length > 0 ? JSON.stringify(input.allowedSubjectIds) : null,
        status: input.status,
      },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
