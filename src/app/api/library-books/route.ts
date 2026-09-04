import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { libraryBookInputSchema } from "@/lib/validation/library-book";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** Catalogue search — brief §4: title/author/ISBN/subject/category/publisher/language, filtered by category and availability. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("libraryCatalogue", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const categoryId = params.get("categoryId") ?? undefined;
    const subjectId = params.get("subjectId") ?? undefined;
    const language = params.get("language") ?? undefined;
    const availableOnly = params.get("availableOnly") === "true";
    const status = params.get("status") ?? "active";

    const where: Prisma.LibraryBookWhereInput = {
      schoolId,
      ...(status !== "all" && { isActive: status === "active" }),
      ...(categoryId && { categoryId }),
      ...(subjectId && { subjectId }),
      ...(language && { language }),
      ...(availableOnly && { copies: { some: { status: "available" } } }),
      ...(q && {
        OR: [
          { title: { contains: q } },
          { author: { contains: q } },
          { isbn10: { contains: q } },
          { isbn13: { contains: q } },
          { publisher: { contains: q } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.libraryBook.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
          copies: { select: { status: true } },
        },
        orderBy: { title: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.libraryBook.count({ where }),
    ]);

    const data = rows.map(({ copies, ...book }) => ({
      ...book,
      counts: {
        copies: copies.length,
        available: copies.filter((c) => c.status === "available").length,
      },
    }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("libraryCatalogue", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(libraryBookInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.libraryBook.create({ data: { schoolId, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "libraryBook.create",
        entityType: "LibraryBook",
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
