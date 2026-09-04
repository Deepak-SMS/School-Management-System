import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { libraryCategoryInputSchema } from "@/lib/validation/library-category";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { DEFAULT_LIBRARY_CATEGORIES } from "@/lib/constants/library";

/**
 * Per-school library categories — the classification every book is filed
 * under. A school with none yet gets the starter set seeded on first read,
 * same lazy-seed pattern as expense categories — usable immediately instead
 * of presenting an empty dropdown with no way past it.
 */
export async function GET() {
  try {
    const { schoolId } = await requirePermission("libraryCatalogue", "view");

    const existing = await prisma.libraryCategory.count({ where: { schoolId } });
    if (existing === 0) {
      await prisma.libraryCategory.createMany({
        data: DEFAULT_LIBRARY_CATEGORIES.map((name) => ({ schoolId, name, isSystemCategory: true })),
      });
    }

    const rows = await prisma.libraryCategory.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
    });

    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        counts: { books: await prisma.libraryBook.count({ where: { categoryId: row.id } }) },
      })),
    );

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("libraryCatalogue", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(libraryCategoryInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.libraryCategory.create({ data: { schoolId, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "libraryCategory.create",
        entityType: "LibraryCategory",
        entityId: row.id,
        after: row,
      });
      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
