import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { attendanceSettingsInputSchema, ATTENDANCE_SETTINGS_DEFAULTS } from "@/lib/validation/attendance-settings";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** One settings row per school — Defaulters' thresholds and which optional statuses a marker may choose. Created on first read with the module defaults, same as LibrarySettings. */
export async function GET() {
  try {
    const { schoolId } = await requirePermission("studentAttendance", "view");

    const settings = await prisma.attendanceSettings.upsert({
      where: { schoolId },
      create: { schoolId, ...ATTENDANCE_SETTINGS_DEFAULTS },
      update: {},
    });

    return NextResponse.json(settings);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requirePermission("studentAttendance", "edit");
    const { schoolId } = user;
    const input = attendanceSettingsInputSchema.parse(await request.json());

    const existing = await prisma.attendanceSettings.upsert({
      where: { schoolId },
      create: { schoolId, ...ATTENDANCE_SETTINGS_DEFAULTS },
      update: {},
    });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.attendanceSettings.update({ where: { schoolId }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "attendanceSettings.update",
        entityType: "AttendanceSettings",
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
