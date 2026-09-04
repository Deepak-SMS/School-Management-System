import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { buildImportWorkbook } from "@/lib/students/student-import";
import { apiError } from "@/lib/api-error";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Downloads the .xlsx import template.
 *
 * Generated from IMPORT_COLUMNS rather than kept as a static file, so the
 * template can never drift from what the importer actually accepts.
 */
export async function GET() {
  try {
    await requirePermission("students", "import");

    const buffer = await buildImportWorkbook();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="student-import-template.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
