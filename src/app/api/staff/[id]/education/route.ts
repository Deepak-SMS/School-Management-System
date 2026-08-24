import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { staffEducationSchema } from "@/lib/validation/staff";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("employees", "view");
    const { id } = await params;

    const staff = await prisma.staff.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const data = await prisma.staffEducation.findMany({
      where: { staffId: id },
      orderBy: [{ passingYear: "desc" }],
    });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("employees", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const staff = await prisma.staff.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const input = cleanEmptyStrings(staffEducationSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.staffEducation.create({ data: { staffId: id, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employee.education.add",
        entityType: "StaffEducation",
        entityId: row.id,
        after: row,
      });
      await recordStaffActivity(tx, {
        schoolId,
        staffId: id,
        type: "profile_updated",
        description: `Education added: ${row.degree}`,
        actorId: user.id,
      });
      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
