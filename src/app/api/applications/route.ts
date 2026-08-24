import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applicationInputSchema } from "@/lib/validation/recruitment";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("candidates", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const status = params.get("status") ?? undefined;
    const vacancyId = params.get("vacancyId") ?? undefined;
    const q = params.get("q")?.trim();

    const where: Prisma.ApplicationWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(vacancyId && { vacancyId }),
      ...(q && {
        OR: [
          { candidate: { firstName: { contains: q } } },
          { candidate: { lastName: { contains: q } } },
          { candidate: { email: { contains: q } } },
          { vacancy: { title: { contains: q } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          candidate: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          vacancy: { select: { id: true, title: true, code: true } },
          _count: { select: { interviews: true, offers: true } },
        },
        orderBy: { appliedDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.application.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

/** Applies an existing candidate to a vacancy. Candidate and vacancy are never created here. */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("candidates", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(applicationInputSchema.parse(await request.json()));

    // Both must belong to this school — otherwise a guessed id could link across tenants.
    const [candidate, vacancy] = await Promise.all([
      prisma.candidate.findFirst({ where: { id: input.candidateId, schoolId } }),
      prisma.vacancy.findFirst({ where: { id: input.vacancyId, schoolId } }),
    ]);
    if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    if (!vacancy) return NextResponse.json({ error: "Vacancy not found." }, { status: 404 });

    if (vacancy.status !== "open") {
      return NextResponse.json(
        { error: `This vacancy is ${vacancy.status} — reopen it before adding applicants.` },
        { status: 409 },
      );
    }

    const existing = await prisma.application.findFirst({
      where: { candidateId: input.candidateId, vacancyId: input.vacancyId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This candidate has already applied to this vacancy.", applicationId: existing.id },
        { status: 409 },
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.application.create({
        data: {
          schoolId,
          candidateId: input.candidateId,
          vacancyId: input.vacancyId,
          source: input.source ?? candidate.source ?? undefined,
          recruiterId: input.recruiterId,
          notes: input.notes,
          status: "new",
        },
      });

      // The first history entry, so the timeline starts at application rather
      // than at the first stage change.
      await tx.applicationStatusHistory.create({
        data: { applicationId: row.id, toStatus: "new", note: "Application received", actorId: user.id },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "application.create",
        entityType: "Application",
        entityId: row.id,
        after: { candidateId: row.candidateId, vacancyId: row.vacancyId, status: row.status },
      });

      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
