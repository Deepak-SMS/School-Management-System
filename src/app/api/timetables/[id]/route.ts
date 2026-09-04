import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { timetableUpdateSchema } from "@/lib/validation/timetable";
import { loadTimetableDetail } from "@/lib/timetable/load-timetable-detail";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "view");
    const { id } = await params;
    const detail = await loadTimetableDetail(id, schoolId);
    if (!detail) return NextResponse.json({ error: "Timetable not found." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "edit");
    const { id } = await params;
    const body = await request.json();
    const input = timetableUpdateSchema.parse(body);

    const existing = await prisma.timetable.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Timetable not found." }, { status: 404 });

    if (input.status === "published") {
      await requirePermission("timetable", "approve");
    }

    const timetable = await prisma.$transaction(async (tx) => {
      if (input.classes) {
        await tx.timetableClass.deleteMany({ where: { timetableId: id } });
        await tx.timetableClass.createMany({
          data: input.classes.map((c) => ({ timetableId: id, classId: c.classId, sectionId: c.sectionId ?? null })),
        });
      }
      return tx.timetable.update({
        where: { id },
        data: { ...(input.name !== undefined && { name: input.name }), ...(input.status !== undefined && { status: input.status }) },
      });
    });

    return NextResponse.json(timetable);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "delete");
    const { id } = await params;
    const existing = await prisma.timetable.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Timetable not found." }, { status: 404 });

    await prisma.timetable.delete({ where: { id } }); // classes/slots cascade via onDelete: Cascade
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
