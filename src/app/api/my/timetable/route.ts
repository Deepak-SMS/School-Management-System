import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { getCurrentStaff } from "@/lib/teacher-scope";
import { apiError } from "@/lib/api-error";

/** The signed-in teacher's own slots across every published timetable — no sectionId/timetableId filter needed, they only ever see their own. */
export async function GET() {
  try {
    await requirePermission("timetable", "view");
    const staff = await getCurrentStaff();

    const slots = await prisma.timetableSlot.findMany({
      where: { teacherId: staff.id, timetable: { status: "published" } },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        room: { select: { id: true, name: true } },
        section: { select: { id: true, name: true, class: { select: { id: true, name: true } } } },
        period: { select: { id: true, label: true, startTime: true, endTime: true, sortOrder: true } },
        timetable: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: slots });
  } catch (error) {
    return apiError(error);
  }
}
