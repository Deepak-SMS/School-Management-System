import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const updateSchema = z.object({
  canAccessPortal: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  isAuthorizedPickup: z.boolean().optional(),
  isLegalGuardian: z.boolean().optional(),
  canReceiveAcademic: z.boolean().optional(),
  canReceiveFee: z.boolean().optional(),
});

/**
 * Toggles flags on a single guardian↔student pairing (most commonly
 * `canAccessPortal`), without touching any other pairing.
 *
 * Deliberately separate from PATCH /api/students/[id], which replaces a
 * student's entire guardians block wholesale — using that here to flip one
 * flag would require resending every guardian on the student, and risks
 * silently dropping one the caller's form didn't have loaded.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("guardians", "edit");
    const { schoolId } = actor;
    const { id } = await params;

    const existing = await prisma.studentGuardian.findFirst({
      where: { id, student: { schoolId } },
    });
    if (!existing) return NextResponse.json({ error: "Guardian link not found." }, { status: 404 });

    const input = updateSchema.parse(await request.json());

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.studentGuardian.update({ where: { id }, data: input });

      await recordAudit(tx, {
        schoolId,
        userId: actor.id,
        action: "student_guardian.update",
        entityType: "StudentGuardian",
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
