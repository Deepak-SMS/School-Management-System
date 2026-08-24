import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { staffExperienceSchema } from "@/lib/validation/staff";
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

    const data = await prisma.staffExperience.findMany({
      where: { staffId: id },
      orderBy: [{ startDate: "desc" }],
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

    const input = cleanEmptyStrings(staffExperienceSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.staffExperience.create({
        data: {
          staffId: id,
          organization: input.organization,
          designation: input.designation,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          description: input.description,
          uploadedFileId: input.uploadedFileId,
        },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employee.experience.add",
        entityType: "StaffExperience",
        entityId: row.id,
        after: row,
      });
      await recordStaffActivity(tx, {
        schoolId,
        staffId: id,
        type: "profile_updated",
        description: `Experience added: ${row.organization}`,
        actorId: user.id,
      });
      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
