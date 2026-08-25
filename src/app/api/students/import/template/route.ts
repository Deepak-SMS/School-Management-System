import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { buildImportTemplate } from "@/lib/students/student-import";
import { apiError } from "@/lib/api-error";

/**
 * Downloads the CSV import template.
 *
 * Generated from IMPORT_COLUMNS rather than kept as a static file, so the
 * template can never drift from what the importer actually accepts.
 */
export async function GET() {
  try {
    await requirePermission("students", "import");

    // Excel needs the BOM to read UTF-8 names (e.g. accented characters) correctly.
    const csv = `﻿${buildImportTemplate()}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="student-import-template.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
