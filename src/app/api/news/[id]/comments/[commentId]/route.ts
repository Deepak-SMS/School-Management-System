import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { newsCommentUpdateSchema } from "@/lib/validation/newsComment";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id: newsId, commentId } = await params;
    const body = await request.json();
    const input = newsCommentUpdateSchema.parse(body);

    const existing = await prisma.newsComment.findFirst({ where: { id: commentId, newsId, news: { schoolId } } });
    if (!existing) return NextResponse.json({ error: "Comment not found." }, { status: 404 });

    const comment = await prisma.$transaction(async (tx) => {
      const updated = await tx.newsComment.update({ where: { id: commentId }, data: { status: input.status } });
      await recordAudit(tx, {
        schoolId,
        action: input.status === "hidden" ? "newsComment.hide" : "newsComment.show",
        entityType: "NewsComment",
        entityId: commentId,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(comment);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id: newsId, commentId } = await params;

    const existing = await prisma.newsComment.findFirst({ where: { id: commentId, newsId, news: { schoolId } } });
    if (!existing) return NextResponse.json({ error: "Comment not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.newsComment.delete({ where: { id: commentId } });
      await recordAudit(tx, { schoolId, action: "newsComment.delete", entityType: "NewsComment", entityId: commentId, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
