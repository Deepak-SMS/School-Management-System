import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { newsUpdateSchema } from "@/lib/validation/news";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { sanitizeNewsHtml } from "@/lib/sanitize-html";
import { resolveSchoolNewsStatuses } from "@/lib/news/resolve-status";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const detailInclude = {
  category: { select: { id: true, name: true, colorHex: true } },
  author: { select: { id: true, fullName: true } },
  featuredImage: { select: { id: true, originalName: true } },
  audienceTargets: {
    include: { class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } },
  },
  attachments: { include: { uploadedFile: { select: { id: true, originalName: true } } } },
  images: { include: { uploadedFile: { select: { id: true, originalName: true } } }, orderBy: { sortOrder: "asc" } },
  comments: { orderBy: { createdAt: "desc" } },
  _count: { select: { comments: true } },
} satisfies Prisma.NewsInclude;

function toFileRef(file: { id: string; originalName: string | null } | null) {
  return file ? { id: file.id, url: `/api/files/${file.id}`, originalName: file.originalName } : null;
}

function serialize(news: Prisma.NewsGetPayload<{ include: typeof detailInclude }>) {
  const { _count, featuredImage, audienceTargets, attachments, images, ...rest } = news;
  return {
    ...rest,
    featuredImage: toFileRef(featuredImage),
    audienceTargets: audienceTargets.map((t) => ({ id: t.id, class: t.class, section: t.section })),
    attachments: attachments.map((a) => ({ id: a.id, label: a.label, file: toFileRef(a.uploadedFile) })),
    images: images.map((i) => ({ id: i.id, caption: i.caption, sortOrder: i.sortOrder, file: toFileRef(i.uploadedFile) })),
    counts: { comments: _count.comments },
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  await resolveSchoolNewsStatuses(schoolId);
  const { id } = await params;

  const news = await prisma.news.findFirst({ where: { id, schoolId }, include: detailInclude });
  if (!news) return NextResponse.json({ error: "News article not found." }, { status: 404 });

  return NextResponse.json(serialize(news));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(newsUpdateSchema.parse(body));

    const existing = await prisma.news.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "News article not found." }, { status: 404 });

    if (input.status === "scheduled" && !input.publishAt && !existing.publishAt) {
      return NextResponse.json(
        { error: "Validation failed", fieldErrors: { publishAt: ["A publish date is required to schedule this article."] } },
        { status: 422 },
      );
    }

    const { audienceTargets, attachmentFileIds, imageFileIds, contentHtml, ...scalarInput } = input;

    const news = await prisma.$transaction(async (tx) => {
      if (audienceTargets) {
        await tx.newsAudienceTarget.deleteMany({ where: { newsId: id } });
      }
      if (attachmentFileIds) {
        await tx.newsAttachment.deleteMany({ where: { newsId: id } });
      }
      if (imageFileIds) {
        await tx.newsImage.deleteMany({ where: { newsId: id } });
      }

      const wasPublished = existing.status === "published";
      const updated = await tx.news.update({
        where: { id },
        data: {
          ...scalarInput,
          contentHtml: contentHtml ? sanitizeNewsHtml(contentHtml) : undefined,
          publishAt: scalarInput.publishAt ? new Date(scalarInput.publishAt) : scalarInput.status === "published" && !existing.publishAt ? new Date() : undefined,
          expiresAt: scalarInput.expiresAt ? new Date(scalarInput.expiresAt) : undefined,
          audienceTargets: audienceTargets ? { create: audienceTargets.map((t) => ({ classId: t.classId, sectionId: t.sectionId })) } : undefined,
          attachments: attachmentFileIds ? { create: attachmentFileIds.map((fileId) => ({ uploadedFileId: fileId })) } : undefined,
          images: imageFileIds ? { create: imageFileIds.map((fileId, i) => ({ uploadedFileId: fileId, sortOrder: i })) } : undefined,
        },
        include: detailInclude,
      });

      if (!wasPublished && updated.status === "published" && updated.notifyInApp) {
        await tx.notification.create({
          data: { schoolId, type: "news_published", title: "News published", description: updated.title, relatedNewsId: updated.id },
        });
      }

      await recordAudit(tx, { schoolId, action: "news.update", entityType: "News", entityId: id, before: existing, after: updated });
      return updated;
    });

    return NextResponse.json(serialize(news));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const existing = await prisma.news.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "News article not found." }, { status: 404 });

    if (existing.status === "published") {
      return NextResponse.json(
        { error: "This article is published. Archive it instead of deleting." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.news.delete({ where: { id } });
      await recordAudit(tx, { schoolId, action: "news.delete", entityType: "News", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
