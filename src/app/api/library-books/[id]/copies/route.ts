import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { libraryBookCopyCreateSchema } from "@/lib/validation/library-book-copy";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { nextAccessionNumber } from "@/lib/library/accession-number";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("libraryCatalogue", "view");
    const { id } = await params;

    const book = await prisma.libraryBook.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!book) return NextResponse.json({ error: "Book not found." }, { status: 404 });

    const copies = await prisma.libraryBookCopy.findMany({ where: { bookId: id }, orderBy: { accessionNumber: "asc" } });
    return NextResponse.json({ data: copies, total: copies.length });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Adds one or more physical copies of this title (brief §3/§5 — "bulk generate
 * barcodes"). Accession number and barcode are always system-generated from
 * `LibraryAccessionCounter`, identical to each other at creation; either can
 * be corrected later via PATCH on the copy.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("libraryCatalogue", "create");
    const { schoolId } = user;
    const { id: bookId } = await params;
    const input = cleanEmptyStrings(libraryBookCopyCreateSchema.parse(await request.json()));

    const book = await prisma.libraryBook.findFirst({ where: { id: bookId, schoolId } });
    if (!book) return NextResponse.json({ error: "Book not found." }, { status: 404 });

    const { quantity, purchaseDate, ...rest } = input;

    const created = await prisma.$transaction(async (tx) => {
      const copies = [];
      for (let i = 0; i < quantity; i++) {
        const code = await nextAccessionNumber(tx, { schoolId });
        const copy = await tx.libraryBookCopy.create({
          data: {
            schoolId,
            bookId,
            accessionNumber: code,
            barcode: code,
            condition: rest.condition ?? "good",
            shelf: rest.shelf ?? book.shelf,
            rack: rest.rack ?? book.rack,
            rowLabel: rest.rowLabel ?? book.rowLabel,
            price: rest.price,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
          },
        });
        copies.push(copy);
      }

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "libraryBookCopy.create",
        entityType: "LibraryBook",
        entityId: bookId,
        after: { quantity, accessionNumbers: copies.map((c) => c.accessionNumber) },
      });

      return copies;
    });

    return NextResponse.json({ data: created, total: created.length }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
