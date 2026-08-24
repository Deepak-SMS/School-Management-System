import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { candidateInputSchema, toJsonArray } from "@/lib/validation/recruitment";
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
    const q = params.get("q")?.trim();
    const source = params.get("source") ?? undefined;
    /** Filter by the stage of any of the candidate's applications. */
    const stage = params.get("stage") ?? undefined;
    const vacancyId = params.get("vacancyId") ?? undefined;

    const where: Prisma.CandidateWhereInput = {
      schoolId,
      ...(source && { source }),
      ...((stage || vacancyId) && {
        applications: { some: { ...(stage && { status: stage }), ...(vacancyId && { vacancyId }) } },
      }),
      ...(q && {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
          { currentOrganization: { contains: q } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        include: {
          applications: {
            select: { id: true, status: true, vacancyId: true, vacancy: { select: { title: true, code: true } } },
          },
          convertedStaff: { select: { id: true, employeeId: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.candidate.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("candidates", "create");
    const { schoolId } = user;
    const { skills, certifications, ...input } = cleanEmptyStrings(
      candidateInputSchema.parse(await request.json()),
    );

    // A candidate may apply to several vacancies over time; reusing the existing
    // record by email is what keeps the talent pool free of duplicates (spec §3.8).
    if (input.email) {
      const duplicate = await prisma.candidate.findFirst({ where: { schoolId, email: input.email } });
      if (duplicate) {
        return NextResponse.json(
          {
            error: "A candidate with this email already exists.",
            candidateId: duplicate.id,
            fieldErrors: { email: ["This candidate is already in the talent pool — open their profile to apply them to another vacancy."] },
          },
          { status: 409 },
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.candidate.create({
        data: {
          schoolId,
          ...input,
          skillsJson: toJsonArray(skills),
          certificationsJson: toJsonArray(certifications),
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "candidate.create",
        entityType: "Candidate",
        entityId: row.id,
        after: { name: `${row.firstName} ${row.lastName ?? ""}`.trim(), email: row.email },
      });

      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
