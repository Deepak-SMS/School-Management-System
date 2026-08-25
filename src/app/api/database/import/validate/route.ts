import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { visibleColumns } from "@/lib/database/datasets";
import { readWorkbook } from "@/lib/database/workbook";
import { planImport } from "@/lib/database/import";
import { apiError } from "@/lib/api-error";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_ROWS = 20_000;

/**
 * Step 1: read the workbook, check every row, write nothing.
 *
 * The administrator sees exactly what would be created and changed, and every
 * problem with a sheet name and row number, before anything is committed. The
 * file is re-uploaded to /commit rather than held server-side between calls.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("database", "import");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large. Maximum size is 25 MB." }, { status: 422 });
    }

    let sheets;
    try {
      sheets = await readWorkbook(Buffer.from(await file.arrayBuffer()));
    } catch {
      return NextResponse.json(
        { error: "That file couldn't be read as an Excel workbook. Save it as .xlsx and try again." },
        { status: 422 },
      );
    }

    const totalRows = sheets.reduce((n, s) => n + s.rows.length, 0);
    if (totalRows === 0) {
      return NextResponse.json({ error: "The workbook has no data rows." }, { status: 422 });
    }
    if (totalRows > MAX_ROWS) {
      return NextResponse.json(
        { error: `The workbook has ${totalRows} rows. Import at most ${MAX_ROWS} at a time.` },
        { status: 422 },
      );
    }

    const { plan } = await planImport(user.schoolId, sheets, (dataset) => visibleColumns(dataset, user));

    if (plan.sheets.length === 0) {
      return NextResponse.json(
        {
          error:
            "No recognised sheets in that workbook. Sheet names must match the template — download it to see the expected names.",
          unknownSheets: plan.unknownSheets,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(plan);
  } catch (error) {
    return apiError(error);
  }
}
