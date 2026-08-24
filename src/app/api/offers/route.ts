import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { offerInputSchema } from "@/lib/validation/recruitment";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { canTransition, InvalidTransitionError } from "@/lib/recruitment-pipeline";
import type { ApplicationStatus } from "@/lib/constants/hr";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

async function nextOfferCode(tx: Prisma.TransactionClient, schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OFR-${year}-`;
  const existing = await tx.offer.findMany({
    where: { schoolId, code: { startsWith: prefix } },
    select: { code: true },
  });
  const highest = existing.reduce((max, { code }) => {
    const parsed = Number.parseInt((code ?? "").slice(prefix.length), 10);
    return Number.isFinite(parsed) && parsed > max ? parsed : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("offers", "view");
    const status = request.nextUrl.searchParams.get("status") ?? undefined;

    const data = await prisma.offer.findMany({
      where: { schoolId, ...(status && { status }) },
      include: {
        application: {
          select: {
            id: true,
            status: true,
            candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
            vacancy: { select: { id: true, title: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("offers", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(offerInputSchema.parse(await request.json()));

    const application = await prisma.application.findFirst({
      where: { id: input.applicationId, schoolId },
    });
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    const from = application.status as ApplicationStatus;
    if (from !== "offered" && !canTransition(from, "offered")) {
      throw new InvalidTransitionError(from, "offered");
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.offer.create({
        data: {
          schoolId,
          ...input,
          code: await nextOfferCode(tx, schoolId),
          // Terms fall back to what was agreed when the candidate was selected.
          designationId: input.designationId ?? application.proposedDesignationId ?? undefined,
          departmentId: input.departmentId ?? application.proposedDepartmentId ?? undefined,
          campusId: input.campusId ?? application.proposedCampusId ?? undefined,
          salaryAmount: input.salaryAmount ?? application.proposedSalary ?? undefined,
          reportingManagerId: input.reportingManagerId ?? application.proposedManagerId ?? undefined,
          joiningDate: input.joiningDate
            ? new Date(input.joiningDate)
            : (application.proposedJoiningDate ?? undefined),
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
          status: "draft",
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "offer.create",
        entityType: "Offer",
        entityId: row.id,
        after: { code: row.code, applicationId: row.applicationId, salaryAmount: row.salaryAmount },
      });

      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
