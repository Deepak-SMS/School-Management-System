import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";

/** Cross-article comment moderation queue — every comment for this school, newest first, with its parent article. */
export async function GET(request: NextRequest) {
  const schoolId = await getCurrentSchoolId();
  const status = request.nextUrl.searchParams.get("status") ?? undefined;

  const comments = await prisma.newsComment.findMany({
    where: { news: { schoolId }, ...(status && { status }) },
    include: { news: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ data: comments });
}
