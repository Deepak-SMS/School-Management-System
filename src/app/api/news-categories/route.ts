import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { newsCategoryInputSchema } from "@/lib/validation/newsCategory";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const schoolId = await getCurrentSchoolId();
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 50)));
  const q = params.get("q")?.trim();
  const status = params.get("status") ?? undefined;

  const where: Prisma.NewsCategoryWhereInput = {
    schoolId,
    ...(status && { status }),
    ...(q && { OR: [{ name: { contains: q } }, { code: { contains: q } }] }),
  };

  const [categories, total] = await Promise.all([
    prisma.newsCategory.findMany({
      where,
      include: { _count: { select: { news: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.newsCategory.count({ where }),
  ]);

  const data = categories.map(({ _count, ...rest }) => ({ ...rest, counts: { news: _count.news } }));
  return NextResponse.json({ data, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const body = await request.json();
    const input = cleanEmptyStrings(newsCategoryInputSchema.parse(body));

    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.newsCategory.create({
        data: { schoolId, name: input.name, code: input.code, colorHex: input.colorHex, status: input.status },
      });
      await recordAudit(tx, { schoolId, action: "newsCategory.create", entityType: "NewsCategory", entityId: created.id, after: created });
      return created;
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
