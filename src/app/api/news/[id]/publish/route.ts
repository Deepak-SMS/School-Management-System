import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;

    const existing = await prisma.news.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "News article not found." }, { status: 404 });
    if (existing.status === "published") {
      return NextResponse.json({ error: "This article is already published." }, { status: 409 });
    }

    const news = await prisma.$transaction(async (tx) => {
      const updated = await tx.news.update({
        where: { id },
        data: { status: "published", publishAt: new Date() },
      });
      if (updated.notifyInApp) {
        await tx.notification.create({
          data: { schoolId, type: "news_published", title: "News published", description: updated.title, relatedNewsId: updated.id },
        });
      }
      await recordAudit(tx, { schoolId, action: "news.publish", entityType: "News", entityId: id, before: existing, after: updated });
      return updated;
    });

    return NextResponse.json(news);
  } catch (error) {
    return apiError(error);
  }
}
