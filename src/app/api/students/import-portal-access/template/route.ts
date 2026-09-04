import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { buildPortalImportTemplate } from "@/lib/students/student-portal-import";
import { apiError } from "@/lib/api-error";

/** Downloads the CSV template for bulk-granting student portal logins. */
export async function GET() {
  try {
    await requirePermission("students", "import");
    await requirePermission("schoolProfile", "edit");

    const csv = `﻿${buildPortalImportTemplate()}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="student-portal-access-template.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
