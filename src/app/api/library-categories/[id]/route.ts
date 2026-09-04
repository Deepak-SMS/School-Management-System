import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { libraryCategoryInputSchema } from "@/lib/validation/library-category";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("libraryCatalogue", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(libraryCategoryInputSchema.partial().parse(await request.json()));

    const existing = await prisma.libraryCategory.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Library category not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.libraryCategory.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "libraryCategory.update",
        entityType: "LibraryCategory",
        entityId: id,
        before: existing,
        after: row,
      });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

/** Refuses to delete a category still in use by a book — same "keep history intact" rule as FeeCategory. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("libraryCatalogue", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.libraryCategory.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Library category not found." }, { status: 404 });

    const inUse = await prisma.libraryBook.count({ where: { categoryId: id } });
    if (inUse > 0) {
      return NextResponse.json(
        { error: `${inUse} book${inUse === 1 ? "" : "s"} still use this category — reassign them before removing it.` },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.libraryCategory.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "libraryCategory.delete",
        entityType: "LibraryCategory",
        entityId: id,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
