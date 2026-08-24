import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { designationInputSchema } from "@/lib/validation/designation";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("designations", "view");
    const { id } = await params;

    const designation = await prisma.designation.findFirst({
      where: { id, schoolId },
      include: { department: { select: { id: true, name: true } } },
    });
    if (!designation) return NextResponse.json({ error: "Designation not found." }, { status: 404 });

    const employees = await prisma.staff.count({ where: { schoolId, designationId: id } });
    return NextResponse.json({ ...designation, counts: { employees } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("designations", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(designationInputSchema.partial().parse(await request.json()));

    const existing = await prisma.designation.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Designation not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.designation.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "designation.update",
        entityType: "Designation",
        entityId: id,
        before: existing,
        after: row,
      });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

/** Deactivates instead of deleting while employees still hold the designation. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("designations", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.designation.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Designation not found." }, { status: 404 });

    const inUse = await prisma.staff.count({ where: { schoolId, designationId: id } });

    const result = await prisma.$transaction(async (tx) => {
      if (inUse > 0) {
        const row = await tx.designation.update({ where: { id }, data: { status: "inactive" } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "designation.deactivate",
          entityType: "Designation",
          entityId: id,
          before: existing,
          after: row,
        });
        return { deactivated: true, employees: inUse };
      }

      await tx.designation.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "designation.delete",
        entityType: "Designation",
        entityId: id,
        before: existing,
      });
      return { deactivated: false, employees: 0 };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
