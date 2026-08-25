import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { selectDatasets, visibleColumns } from "@/lib/database/datasets";
import { buildWorkbook } from "@/lib/database/workbook";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The whole database as one workbook, read live at the moment of download — so
 * anything edited or added anywhere in the app is already in the file, with no
 * separate sync step to fall behind.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("database", "export");
    const datasets = selectDatasets(request.nextUrl.searchParams.get("datasets"));

    const sheets = await Promise.all(
      datasets.map(async (dataset) => ({
        dataset,
        columns: visibleColumns(dataset, user),
        rows: await dataset.load(user.schoolId),
      })),
    );

    const rowTotal = sheets.reduce((n, s) => n + s.rows.length, 0);

    const buffer = await buildWorkbook(sheets, {
      title: "School database export",
      notes: [
        `Exported ${new Date().toISOString().slice(0, 16).replace("T", " ")} by ${user.name}.`,
        "Edit any sheet and upload this same file under Import to apply the changes.",
        "Records are matched by their key column (admission number, employee ID, code) — editing a row updates it, adding a row creates one.",
        "Deleting a row here does NOT delete the record. Remove records in the app instead.",
        "Reference columns use names, not internal IDs — write 'Class 8', not a code.",
      ],
      includeCounts: true,
    });

    // Exporting the whole database is worth a trace of who took a copy.
    await prisma.$transaction(async (tx) => {
      await recordAudit(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: "database.export",
        entityType: "Database",
        entityId: user.schoolId,
        after: { datasets: datasets.map((d) => d.key), rows: rowTotal },
      });
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="school-database-${stamp}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
