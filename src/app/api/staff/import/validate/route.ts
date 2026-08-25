import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { extractRows, type RowError } from "@/lib/csv-import";
import { EMPLOYEE_IMPORT_COLUMNS, validateEmployeeRow } from "@/lib/employees/employee-import";
import { buildEmployeeImportContext } from "@/lib/employees/employee-import-context";
import { apiError } from "@/lib/api-error";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

/** Step 1 of the employee import: parse and validate, write nothing. */
export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("employees", "import");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large. Maximum size is 5 MB." }, { status: 422 });
    }

    const parsed = extractRows(await file.text(), EMPLOYEE_IMPORT_COLUMNS);

    if (parsed.missingHeaders.length > 0) {
      return NextResponse.json(
        {
          error: `The file is missing required columns: ${parsed.missingHeaders.join(", ")}. Download the template to get the right headers.`,
          missingHeaders: parsed.missingHeaders,
        },
        { status: 422 },
      );
    }
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: "The file has headers but no data rows." }, { status: 422 });
    }
    if (parsed.rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `The file has ${parsed.rows.length} rows. Import at most ${MAX_ROWS} at a time.` },
        { status: 422 },
      );
    }

    const context = await buildEmployeeImportContext(schoolId);
    const errors: RowError[] = [...parsed.errors];
    const seenInFile = new Set<string>();
    const validRows: typeof parsed.rows = [];

    for (const row of parsed.rows) {
      const rowErrors = validateEmployeeRow(row, context, seenInFile);
      if (rowErrors.length > 0) errors.push(...rowErrors);
      else validRows.push(row);
    }

    return NextResponse.json({
      totalRows: parsed.rows.length,
      validCount: validRows.length,
      errorCount: parsed.rows.length - validRows.length,
      unknownHeaders: parsed.unknownHeaders,
      errors: errors.slice(0, 200),
      errorsTruncated: errors.length > 200,
      validRows,
      preview: validRows.slice(0, 10).map((r) => r.values),
    });
  } catch (error) {
    return apiError(error);
  }
}
