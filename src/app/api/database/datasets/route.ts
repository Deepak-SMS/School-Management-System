import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { DATASETS, visibleColumns } from "@/lib/database/datasets";
import { apiError } from "@/lib/api-error";

/** What the database page lists: every sheet, its size, and whether it can be imported. */
export async function GET() {
  try {
    const user = await requirePermission("database", "view");

    const data = await Promise.all(
      DATASETS.map(async (d) => ({
        key: d.key,
        label: d.label,
        description: d.description,
        importable: d.importable,
        columnCount: visibleColumns(d, user).length,
        rowCount: await d.count(user.schoolId),
      })),
    );

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}
