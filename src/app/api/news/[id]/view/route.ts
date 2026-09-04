import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { apiError } from "@/lib/api-error";

/** Increments the article's view count. Not per-user — there's no logged-in identity for students/parents yet. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;

    const existing = await prisma.news.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "News article not found." }, { status: 404 });

    const updated = await prisma.news.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    return NextResponse.json({ viewCount: updated.viewCount });
  } catch (error) {
    return apiError(error);
  }
}
