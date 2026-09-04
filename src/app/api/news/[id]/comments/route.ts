import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { newsCommentInputSchema } from "@/lib/validation/newsComment";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;

  const news = await prisma.news.findFirst({ where: { id, schoolId } });
  if (!news) return NextResponse.json({ error: "News article not found." }, { status: 404 });

  const comments = await prisma.newsComment.findMany({ where: { newsId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data: comments });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const body = await request.json();
    const input = newsCommentInputSchema.parse(body);

    const news = await prisma.news.findFirst({ where: { id, schoolId } });
    if (!news) return NextResponse.json({ error: "News article not found." }, { status: 404 });
    if (!news.commentsEnabled) {
      return NextResponse.json({ error: "Comments are turned off for this article." }, { status: 403 });
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.newsComment.create({
        data: { newsId: id, authorName: input.authorName, authorRole: input.authorRole, content: input.content },
      });
      await recordAudit(tx, { schoolId, action: "newsComment.create", entityType: "NewsComment", entityId: created.id, after: created });
      return created;
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
