import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { buildTemplate } from "@/lib/csv-import";
import { EMPLOYEE_IMPORT_COLUMNS, EMPLOYEE_IMPORT_NOTES } from "@/lib/employees/employee-import";
import { apiError } from "@/lib/api-error";

/** Downloads the employee CSV template, generated from the importer's own columns. */
export async function GET() {
  try {
    await requirePermission("employees", "import");

    // The BOM makes Excel read UTF-8 names correctly.
    const csv = `﻿${buildTemplate(EMPLOYEE_IMPORT_COLUMNS, EMPLOYEE_IMPORT_NOTES)}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="employee-import-template.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
