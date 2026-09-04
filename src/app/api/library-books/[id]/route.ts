import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { libraryBookInputSchema } from "@/lib/validation/library-book";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("libraryCatalogue", "view");
    const { id } = await params;

    const book = await prisma.libraryBook.findFirst({
      where: { id, schoolId },
      include: {
        category: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        copies: { orderBy: { accessionNumber: "asc" } },
      },
    });
    if (!book) return NextResponse.json({ error: "Book not found." }, { status: 404 });

    return NextResponse.json(book);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("libraryCatalogue", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(libraryBookInputSchema.partial().parse(await request.json()));

    const existing = await prisma.libraryBook.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Book not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.libraryBook.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "libraryBook.update",
        entityType: "LibraryBook",
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

/** Deactivates rather than deletes when copies still exist, so accession/circulation history is never orphaned. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("libraryCatalogue", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.libraryBook.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Book not found." }, { status: 404 });

    const copyCount = await prisma.libraryBookCopy.count({ where: { bookId: id } });

    const result = await prisma.$transaction(async (tx) => {
      if (copyCount > 0) {
        const row = await tx.libraryBook.update({ where: { id }, data: { isActive: false } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "libraryBook.deactivate",
          entityType: "LibraryBook",
          entityId: id,
          before: existing,
          after: row,
        });
        return { deactivated: true, copies: copyCount };
      }

      await tx.libraryBook.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "libraryBook.delete",
        entityType: "LibraryBook",
        entityId: id,
        before: existing,
      });
      return { deactivated: false, copies: 0 };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
