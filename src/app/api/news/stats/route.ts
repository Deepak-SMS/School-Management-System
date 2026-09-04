import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { resolveSchoolNewsStatuses } from "@/lib/news/resolve-status";

export async function GET() {
  const schoolId = await getCurrentSchoolId();
  await resolveSchoolNewsStatuses(schoolId);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [total, published, scheduled, drafts, archived, pinned, publishedThisMonth] = await Promise.all([
    prisma.news.count({ where: { schoolId } }),
    prisma.news.count({ where: { schoolId, status: "published" } }),
    prisma.news.count({ where: { schoolId, status: "scheduled" } }),
    prisma.news.count({ where: { schoolId, status: "draft" } }),
    prisma.news.count({ where: { schoolId, status: "archived" } }),
    prisma.news.count({ where: { schoolId, priority: "pinned" } }),
    prisma.news.count({ where: { schoolId, status: "published", publishAt: { gte: monthStart } } }),
  ]);

  return NextResponse.json({ total, published, scheduled, drafts, archived, pinned, publishedThisMonth });
}
