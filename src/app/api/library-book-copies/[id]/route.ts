import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { libraryBookCopyUpdateSchema } from "@/lib/validation/library-book-copy";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("libraryCatalogue", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const { purchaseDate, ...rest } = cleanEmptyStrings(libraryBookCopyUpdateSchema.partial().parse(await request.json()));

    const existing = await prisma.libraryBookCopy.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Copy not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.libraryBookCopy.update({
        where: { id },
        data: { ...rest, ...(purchaseDate !== undefined && { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }) },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "libraryBookCopy.update",
        entityType: "LibraryBookCopy",
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

/** Only a copy that was never issued can be removed outright — one that's had any circulation gets its status set to `removed` instead once that history exists (later phase). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("libraryCatalogue", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.libraryBookCopy.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Copy not found." }, { status: 404 });
    if (existing.status !== "available") {
      return NextResponse.json({ error: "Only a copy that is currently available can be removed." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.libraryBookCopy.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "libraryBookCopy.delete",
        entityType: "LibraryBookCopy",
        entityId: id,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
