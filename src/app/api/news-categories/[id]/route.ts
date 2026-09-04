import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { newsCategoryInputSchema } from "@/lib/validation/newsCategory";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(newsCategoryInputSchema.partial().parse(body));

    const existing = await prisma.newsCategory.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Category not found." }, { status: 404 });

    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.newsCategory.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        action: "newsCategory.update",
        entityType: "NewsCategory",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(category);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const existing = await prisma.newsCategory.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Category not found." }, { status: 404 });

    const newsCount = await prisma.news.count({ where: { categoryId: id } });
    if (newsCount > 0) {
      return NextResponse.json(
        { error: "This category has news articles assigned to it. Deactivate it instead of deleting." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.newsCategory.delete({ where: { id } });
      await recordAudit(tx, { schoolId, action: "newsCategory.delete", entityType: "NewsCategory", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
