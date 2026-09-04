import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { librarySettingsInputSchema, LIBRARY_SETTINGS_DEFAULTS } from "@/lib/validation/library-settings";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** One settings row per school — borrowing limits and fine rules every later circulation/fine route reads. Created on first read with the module defaults, same as School itself. */
export async function GET() {
  try {
    const { schoolId } = await requirePermission("librarySettings", "view");

    const settings = await prisma.librarySettings.upsert({
      where: { schoolId },
      create: { schoolId, ...LIBRARY_SETTINGS_DEFAULTS },
      update: {},
    });

    return NextResponse.json(settings);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requirePermission("librarySettings", "edit");
    const { schoolId } = user;
    const input = librarySettingsInputSchema.parse(await request.json());

    const existing = await prisma.librarySettings.upsert({
      where: { schoolId },
      create: { schoolId, ...LIBRARY_SETTINGS_DEFAULTS },
      update: {},
    });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.librarySettings.update({ where: { schoolId }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "librarySettings.update",
        entityType: "LibrarySettings",
        entityId: row.id,
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
