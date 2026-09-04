import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { certificateTypeInputSchema, CERTIFICATE_TYPE_DEFAULTS } from "@/lib/validation/certificate";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** System types (schoolId = null, shared) + this school's own — same pattern as ID card templates. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("certificateTypes", "view");
    const category = request.nextUrl.searchParams.get("category") ?? undefined;

    const where: Prisma.CertificateTypeWhereInput = {
      OR: [{ isSystemType: true }, { schoolId }],
      ...(category && { category }),
    };

    const rows = await prisma.certificateType.findMany({
      where,
      orderBy: [{ isSystemType: "desc" }, { category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ data: rows, total: rows.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("certificateTypes", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(certificateTypeInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.certificateType.create({ data: { schoolId, ...CERTIFICATE_TYPE_DEFAULTS, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "certificateType.create",
        entityType: "CertificateType",
        entityId: row.id,
        after: row,
      });
      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
