import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import {
  extractPortalImportRows,
  validatePortalImportRow,
  loadPortalImportContext,
  PORTAL_IMPORT_COLUMNS,
  type PortalImportRowError,
} from "@/lib/students/student-portal-import";
import { apiError } from "@/lib/api-error";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

/** Step 1: parse and validate a bulk portal-access file, write nothing. */
export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("students", "import");
    await requirePermission("schoolProfile", "edit");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large. Maximum size is 5 MB." }, { status: 422 });
    }

    const text = await file.text();
    const parsed = extractPortalImportRows(text);

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

    const context = await loadPortalImportContext(schoolId);

    const errors: PortalImportRowError[] = [...parsed.errors];
    const seenAdmissionNumbers = new Set<string>();
    const seenEmails = new Set<string>();
    const validRows: typeof parsed.rows = [];

    for (const row of parsed.rows) {
      const rowErrors = validatePortalImportRow(row, context, seenAdmissionNumbers, seenEmails);
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
      preview: validRows.slice(0, 10).map((r) => ({
        ...r.values,
        studentName: (() => {
          const s = context.studentsByAdmissionNumber.get(r.values.admissionNumber.toLowerCase());
          return s ? `${s.firstName} ${s.lastName}` : "";
        })(),
      })),
      columns: PORTAL_IMPORT_COLUMNS.map((c) => ({ header: c.header, field: c.field })),
    });
  } catch (error) {
    return apiError(error);
  }
}
