import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { selectDatasets, visibleColumns } from "@/lib/database/datasets";
import { buildWorkbook } from "@/lib/database/workbook";
import { apiError } from "@/lib/api-error";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The same workbook as Export, with one example row per sheet instead of the
 * school's data — for filling in from scratch. Generated from the same column
 * registry, so it can never ask for a column the importer doesn't accept.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("database", "view");
    const datasets = selectDatasets(request.nextUrl.searchParams.get("datasets"));

    const sheets = datasets.map((dataset) => {
      const columns = visibleColumns(dataset, user);
      return {
        dataset,
        columns,
        rows: [Object.fromEntries(columns.map((c) => [c.field, c.example]))],
      };
    });

    const buffer = await buildWorkbook(sheets, {
      title: "School database template",
      notes: [
        "Each sheet holds one example row. Replace it with your own data — don't leave it in.",
        "Columns shown in blue are required.",
        "Reference columns use names, not internal IDs — write 'Class 8', not a code.",
        "Sheets are read in order, so a class can be created in the same file as the sections that use it.",
        "The Read Me sheet below lists every column and the values it accepts.",
      ],
      includeCounts: false,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="school-database-template.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
