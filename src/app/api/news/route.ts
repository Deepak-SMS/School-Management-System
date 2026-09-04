import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { newsInputSchema } from "@/lib/validation/news";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { sanitizeNewsHtml } from "@/lib/sanitize-html";
import { resolveSchoolNewsStatuses } from "@/lib/news/resolve-status";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const priorityOrder = { pinned: 0, urgent: 1, important: 2, normal: 3 };

const listInclude = {
  category: { select: { id: true, name: true, colorHex: true } },
  author: { select: { id: true, fullName: true } },
  featuredImage: { select: { id: true, originalName: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.NewsInclude;

function toFileRef(file: { id: string; originalName: string | null } | null) {
  return file ? { id: file.id, url: `/api/files/${file.id}`, originalName: file.originalName } : null;
}

export async function GET(request: NextRequest) {
  const schoolId = await getCurrentSchoolId();
  await resolveSchoolNewsStatuses(schoolId);

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
  const q = params.get("q")?.trim();
  const status = params.get("status") ?? undefined;
  const categoryId = params.get("categoryId") ?? undefined;
  const priority = params.get("priority") ?? undefined;
  const audienceType = params.get("audienceType") ?? undefined;

  const where: Prisma.NewsWhereInput = {
    schoolId,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(priority && { priority }),
    ...(audienceType && { audienceType }),
    ...(q && { OR: [{ title: { contains: q } }, { shortDescription: { contains: q } }] }),
  };

  const [rows, total] = await Promise.all([
    prisma.news.findMany({ where, include: listInclude, orderBy: { createdAt: "desc" } }),
    prisma.news.count({ where }),
  ]);

  const sorted = rows.sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]);
  const page_ = sorted.slice((page - 1) * pageSize, page * pageSize);

  const data = page_.map(({ _count, featuredImage, ...rest }) => ({
    ...rest,
    featuredImage: toFileRef(featuredImage),
    counts: { comments: _count.comments },
  }));

  return NextResponse.json({ data, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const body = await request.json();
    const input = cleanEmptyStrings(newsInputSchema.parse(body));

    if (input.status === "scheduled" && !input.publishAt) {
      return NextResponse.json(
        { error: "Validation failed", fieldErrors: { publishAt: ["A publish date is required to schedule this article."] } },
        { status: 422 },
      );
    }

    const contentHtml = sanitizeNewsHtml(input.contentHtml);

    const news = await prisma.$transaction(async (tx) => {
      const created = await tx.news.create({
        data: {
          schoolId,
          title: input.title,
          shortDescription: input.shortDescription,
          contentHtml,
          categoryId: input.categoryId,
          authorStaffId: input.authorStaffId,
          featuredImageFileId: input.featuredImageFileId,
          priority: input.priority,
          status: input.status,
          audienceType: input.audienceType,
          commentsEnabled: input.commentsEnabled,
          notifyInApp: input.notifyInApp,
          publishAt: input.status === "published" ? new Date() : input.publishAt ? new Date(input.publishAt) : undefined,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          autoArchiveAfterExpiry: input.autoArchiveAfterExpiry,
          audienceTargets: { create: input.audienceTargets.map((t) => ({ classId: t.classId, sectionId: t.sectionId })) },
          attachments: { create: input.attachmentFileIds.map((fileId) => ({ uploadedFileId: fileId })) },
          images: { create: input.imageFileIds.map((fileId, i) => ({ uploadedFileId: fileId, sortOrder: i })) },
        },
        include: listInclude,
      });

      if (created.status === "published" && created.notifyInApp) {
        await tx.notification.create({
          data: { schoolId, type: "news_published", title: "News published", description: created.title, relatedNewsId: created.id },
        });
      }

      await recordAudit(tx, { schoolId, action: "news.create", entityType: "News", entityId: created.id, after: created });
      return created;
    });

    const { _count, featuredImage, ...rest } = news;
    return NextResponse.json({ ...rest, featuredImage: toFileRef(featuredImage), counts: { comments: _count.comments } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
