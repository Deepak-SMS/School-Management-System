import { prisma } from "@/lib/db";

/**
 * There is no background job runner in this app, so "Scheduled → auto-publish"
 * and "Published → auto-expire/archive" are applied lazily whenever news is
 * read, rather than by a cron worker. Called at the top of the News list/
 * detail GET handlers before querying.
 */
export async function resolveSchoolNewsStatuses(schoolId: string): Promise<void> {
  const now = new Date();

  const dueToPublish = await prisma.news.findMany({
    where: { schoolId, status: "scheduled", publishAt: { lte: now } },
    select: { id: true, title: true, notifyInApp: true },
  });

  if (dueToPublish.length > 0) {
    await prisma.news.updateMany({
      where: { id: { in: dueToPublish.map((n) => n.id) } },
      data: { status: "published" },
    });
    await prisma.notification.createMany({
      data: dueToPublish
        .filter((n) => n.notifyInApp)
        .map((n) => ({
          schoolId,
          type: "news_published",
          title: "News published",
          description: n.title,
          relatedNewsId: n.id,
        })),
    });
  }

  await prisma.news.updateMany({
    where: { schoolId, status: "published", expiresAt: { lte: now }, autoArchiveAfterExpiry: true },
    data: { status: "archived" },
  });
  await prisma.news.updateMany({
    where: { schoolId, status: "published", expiresAt: { lte: now }, autoArchiveAfterExpiry: false },
    data: { status: "expired" },
  });
}
