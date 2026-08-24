import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { vacancyInputSchema, VACANCY_DEFAULTS, toJsonArray } from "@/lib/validation/recruitment";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Allocates the next vacancy reference for the year, e.g. VAC-2026-001.
 * Called inside the create transaction; the `@@unique([schoolId, code])`
 * constraint is the backstop against a concurrent duplicate.
 */
async function nextVacancyCode(tx: Prisma.TransactionClient, schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VAC-${year}-`;
  const existing = await tx.vacancy.findMany({
    where: { schoolId, code: { startsWith: prefix } },
    select: { code: true },
  });
  const highest = existing.reduce((max, { code }) => {
    const parsed = Number.parseInt(code.slice(prefix.length), 10);
    return Number.isFinite(parsed) && parsed > max ? parsed : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("vacancies", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;
    const departmentId = params.get("departmentId") ?? undefined;
    const campusId = params.get("campusId") ?? undefined;

    const where: Prisma.VacancyWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(departmentId && { departmentId }),
      ...(campusId && { campusId }),
      ...(q && { OR: [{ title: { contains: q } }, { code: { contains: q } }] }),
    };

    const [rows, total] = await Promise.all([
      prisma.vacancy.findMany({
        where,
        include: {
          employeeType: { select: { id: true, name: true } },
          hiringManager: { select: { id: true, fullName: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vacancy.count({ where }),
    ]);

    // Per-vacancy pipeline counts, so the list shows progress not just a total.
    const data = await Promise.all(
      rows.map(async (row) => {
        const byStage = await prisma.application.groupBy({
          by: ["status"],
          where: { vacancyId: row.id },
          _count: { _all: true },
        });
        const stage = (s: string) => byStage.find((b) => b.status === s)?._count._all ?? 0;
        return {
          ...row,
          counts: {
            applications: row._count.applications,
            shortlisted: stage("shortlisted"),
            interview: stage("interview"),
            selected: stage("selected"),
            joined: stage("joined"),
          },
        };
      }),
    );

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("vacancies", "create");
    const { schoolId } = user;
    const { skills, ...input } = cleanEmptyStrings(vacancyInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const code = input.code?.trim() || (await nextVacancyCode(tx, schoolId));

      const row = await tx.vacancy.create({
        data: {
          schoolId,
          ...VACANCY_DEFAULTS,
          ...input,
          code,
          skillsJson: toJsonArray(skills),
          openingDate: input.openingDate ? new Date(input.openingDate) : undefined,
          closingDate: input.closingDate ? new Date(input.closingDate) : undefined,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "vacancy.create",
        entityType: "Vacancy",
        entityId: row.id,
        after: { code: row.code, title: row.title, status: row.status },
      });

      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
