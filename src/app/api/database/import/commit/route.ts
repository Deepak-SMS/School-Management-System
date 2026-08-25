import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { visibleColumns } from "@/lib/database/datasets";
import { readWorkbook } from "@/lib/database/workbook";
import { planImport, applyImport } from "@/lib/database/import";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Step 2: write the rows that validated.
 *
 * Re-validates rather than trusting anything the client sends back — the plan
 * shown to the administrator is a preview, not an authorization. A workbook
 * with any invalid row is refused outright: importing "the good half" silently
 * is exactly the partial import that must never happen.
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

    const { plan, prepared } = await planImport(user.schoolId, sheets, (dataset) => visibleColumns(dataset, user));

    if (plan.issues.length > 0) {
      return NextResponse.json(
        {
          error: `The workbook still has ${plan.issues.length} problem${plan.issues.length === 1 ? "" : "s"}. Nothing was imported — fix them and upload again.`,
          issues: plan.issues.slice(0, 200),
        },
        { status: 422 },
      );
    }
    if (plan.sheets.length === 0) {
      return NextResponse.json({ error: "No recognised sheets in that workbook." }, { status: 422 });
    }

    const result = await applyImport(user.schoolId, prepared);

    await prisma.$transaction(async (tx) => {
      await recordAudit(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: "database.import",
        entityType: "Database",
        entityId: user.schoolId,
        after: { created: result.created, updated: result.updated, sheets: result.bySheet },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
