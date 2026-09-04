import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Clones a Starter (system) certificate type into this school's own editable
 * copy — the same "duplicate instead of mutate shared data" pattern used for
 * certificate templates (see certificate-templates/[id]/duplicate). Never
 * touches the source, since it's shared across every school on the platform.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("certificateTypes", "create");
    const { schoolId } = user;
    const { id } = await params;

    const source = await prisma.certificateType.findFirst({ where: { id, OR: [{ isSystemType: true }, { schoolId }] } });
    if (!source) return NextResponse.json({ error: "Certificate type not found." }, { status: 404 });

    const copy = await prisma.$transaction(async (tx) => {
      const row = await tx.certificateType.create({
        data: {
          schoolId,
          isSystemType: false,
          key: source.key,
          name: `${source.name} (Copy)`,
          category: source.category,
          numberingPrefix: source.numberingPrefix,
          requiresApproval: source.requiresApproval,
          isActive: true,
        },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "certificateType.duplicate",
        entityType: "CertificateType",
        entityId: row.id,
        after: row,
      });
      return row;
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
