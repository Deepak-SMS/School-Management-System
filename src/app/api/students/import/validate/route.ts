import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import {
  extractRows,
  extractRowsFromWorkbook,
  validateRow,
  IMPORT_COLUMNS,
  type ParseResult,
  type RowError,
  type ValidationContext,
} from "@/lib/students/student-import";
import { apiError } from "@/lib/api-error";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

/**
 * Step 1 of the import: parse and validate, write nothing.
 *
 * Returns every error found plus a preview of the rows that would be created, so
 * the administrator sees exactly what will happen before committing. The parsed
 * rows come back with the response and are posted to /commit — the file is never
 * held in server memory between the two calls.
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("students", "import");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large. Maximum size is 5 MB." }, { status: 422 });
    }

    const isExcel =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    let parsed: ParseResult;
    if (isExcel) {
      try {
        parsed = await extractRowsFromWorkbook(Buffer.from(await file.arrayBuffer()));
      } catch {
        return NextResponse.json(
          { error: "That file couldn't be read as an Excel workbook. Save it as .xlsx and try again." },
          { status: 422 },
        );
      }
    } else {
      parsed = extractRows(await file.text());
    }

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

    // Resolve the school's real classes/sections and existing admission numbers
    // once, so per-row validation is in-memory rather than a query per row.
    const [classes, existing] = await Promise.all([
      prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, sections: { select: { id: true, name: true } } },
      }),
      prisma.student.findMany({ where: { schoolId }, select: { admissionNumber: true } }),
    ]);

    const context: ValidationContext = {
      classes: new Map(
        classes.map((c) => [
          c.name.toLowerCase(),
          { id: c.id, sections: new Map(c.sections.map((s) => [s.name.toLowerCase(), s.id])) },
        ]),
      ),
      existingAdmissionNumbers: new Set(existing.map((s) => s.admissionNumber.toLowerCase())),
    };

    const errors: RowError[] = [...parsed.errors];
    const seenInFile = new Set<string>();
    const validRows: typeof parsed.rows = [];

    for (const row of parsed.rows) {
      const rowErrors = validateRow(row, context, seenInFile);
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
      /** Rows safe to create — posted back to /commit unchanged. */
      validRows,
      /** First few valid rows, for the on-screen preview table. */
      preview: validRows.slice(0, 10).map((r) => r.values),
      columns: IMPORT_COLUMNS.map((c) => ({ header: c.header, field: c.field })),
    });
  } catch (error) {
    return apiError(error);
  }
}
