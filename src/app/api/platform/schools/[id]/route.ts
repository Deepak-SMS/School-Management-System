import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/platform-auth";
import { updateSchoolSchema } from "@/lib/validation/platform-school";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordPlatformAudit, describeChange } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { loadSchoolDetail, SchoolHasDataError } from "@/lib/platform-schools";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const detail = await loadSchoolDetail(id);
    if (!detail) return NextResponse.json({ error: "School not found." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const input = cleanEmptyStrings(updateSchoolSchema.parse(await request.json()));

    const before = await prisma.school.findUniqueOrThrow({ where: { id } });

    await prisma.$transaction(async (tx) => {
      await tx.school.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.shortName !== undefined && { shortName: input.shortName }),
          ...(input.address !== undefined && { address: input.address }),
          ...(input.city !== undefined && { city: input.city }),
          ...(input.state !== undefined && { state: input.state }),
          ...(input.country !== undefined && { country: input.country }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.plan !== undefined && { plan: input.plan }),
          ...(input.enabledModules !== undefined && {
            enabledModulesJson: input.enabledModules === null ? null : JSON.stringify(input.enabledModules),
          }),
        },
      });

      const detailsChanged =
        (input.name !== undefined && input.name !== before.name) ||
        (input.shortName !== undefined && input.shortName !== before.shortName) ||
        (input.address !== undefined && input.address !== before.address) ||
        (input.city !== undefined && input.city !== before.city) ||
        (input.state !== undefined && input.state !== before.state) ||
        (input.country !== undefined && input.country !== before.country) ||
        (input.phone !== undefined && input.phone !== before.phone) ||
        (input.email !== undefined && input.email !== before.email);
      if (detailsChanged) {
        await recordPlatformAudit(tx, {
          actorUserId: actor.id,
          action: "school.details_updated",
          targetSchoolId: id,
          metadata: {
            name: input.name !== undefined ? describeChange("Name", before.name, input.name) : undefined,
            shortName:
              input.shortName !== undefined ? describeChange("Short name", before.shortName, input.shortName) : undefined,
          },
        });
      }

      if (input.status !== undefined && input.status !== before.status) {
        await recordPlatformAudit(tx, {
          actorUserId: actor.id,
          action: "school.status_changed",
          targetSchoolId: id,
          metadata: { change: describeChange("Status", before.status, input.status) },
        });
      }
      if (input.plan !== undefined && input.plan !== before.plan) {
        await recordPlatformAudit(tx, {
          actorUserId: actor.id,
          action: "school.plan_changed",
          targetSchoolId: id,
          metadata: { change: describeChange("Plan", before.plan, input.plan) },
        });
      }
      if (input.enabledModules !== undefined) {
        await recordPlatformAudit(tx, {
          actorUserId: actor.id,
          action: "school.modules_updated",
          targetSchoolId: id,
          metadata: { enabledModules: input.enabledModules },
        });
      }
    });

    const detail = await loadSchoolDetail(id);
    return NextResponse.json(detail);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;

    const school = await prisma.school.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { students: true, staff: true } } },
    });

    // Cascading deletes mean this wipes the school's entire data tree — only
    // allow it while there's nothing real to lose. A school with data should
    // be moved to "Cancelled" status instead.
    if (school._count.students > 0 || school._count.staff > 0) {
      throw new SchoolHasDataError();
    }

    await prisma.$transaction(async (tx) => {
      await recordPlatformAudit(tx, {
        actorUserId: actor.id,
        action: "school.deleted",
        targetSchoolId: null,
        metadata: { schoolId: id, name: school.name, shortName: school.shortName },
      });
      await tx.school.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
