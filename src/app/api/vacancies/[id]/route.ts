import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { vacancyInputSchema, toJsonArray, fromJsonArray } from "@/lib/validation/recruitment";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("vacancies", "view");
    const { id } = await params;

    const vacancy = await prisma.vacancy.findFirst({
      where: { id, schoolId },
      include: {
        employeeType: { select: { id: true, name: true } },
        hiringManager: { select: { id: true, fullName: true } },
        applications: {
          include: {
            candidate: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            _count: { select: { interviews: true, offers: true } },
          },
          orderBy: { appliedDate: "desc" },
        },
      },
    });
    if (!vacancy) return NextResponse.json({ error: "Vacancy not found." }, { status: 404 });

    return NextResponse.json({ ...vacancy, skills: fromJsonArray(vacancy.skillsJson) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("vacancies", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.vacancy.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Vacancy not found." }, { status: 404 });

    const { skills, ...input } = cleanEmptyStrings(vacancyInputSchema.partial().parse(await request.json()));

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.vacancy.update({
        where: { id },
        data: {
          ...input,
          ...(skills !== undefined && { skillsJson: toJsonArray(skills) }),
          openingDate: input.openingDate ? new Date(input.openingDate) : undefined,
          closingDate: input.closingDate ? new Date(input.closingDate) : undefined,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: existing.status !== row.status ? "vacancy.status_change" : "vacancy.update",
        entityType: "Vacancy",
        entityId: id,
        before: { status: existing.status, title: existing.title },
        after: { status: row.status, title: row.title },
      });

      return row;
    });

    return NextResponse.json({ ...updated, skills: fromJsonArray(updated.skillsJson) });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Closes a vacancy rather than deleting it once anyone has applied — the
 * applications and their history must survive. A vacancy nobody applied to is
 * safe to remove outright.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("vacancies", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.vacancy.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Vacancy not found." }, { status: 404 });

    const applications = await prisma.application.count({ where: { vacancyId: id } });

    const result = await prisma.$transaction(async (tx) => {
      if (applications > 0) {
        await tx.vacancy.update({ where: { id }, data: { status: "closed" } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "vacancy.close",
          entityType: "Vacancy",
          entityId: id,
          before: { status: existing.status },
          after: { status: "closed" },
        });
        return { closed: true, applications };
      }

      await tx.vacancy.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "vacancy.delete",
        entityType: "Vacancy",
        entityId: id,
        before: existing,
      });
      return { closed: false, applications: 0 };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
