import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { admissionEnquiryInputSchema } from "@/lib/validation/admission-enquiry";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** The pre-application lead queue — walk-in/phone/website contacts, before a formal admission form is submitted. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("admissionEnquiries", "view");
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const source = params.get("source");
    const assignedToId = params.get("assignedToId");
    const q = params.get("q")?.trim();

    const where: Prisma.AdmissionEnquiryWhereInput = {
      schoolId,
      // Default view is the working queue — leads not yet converted or closed out.
      ...(status ? { status } : { status: { notIn: ["converted", "not_interested"] } }),
      ...(source && { source }),
      ...(assignedToId && { assignedToId }),
      ...(q && {
        OR: [
          { parentName: { contains: q } },
          { childName: { contains: q } },
          { parentPhone: { contains: q } },
        ],
      }),
    };

    const data = await prisma.admissionEnquiry.findMany({
      where,
      include: {
        interestedClass: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("admissionEnquiries", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(admissionEnquiryInputSchema.parse(await request.json()));

    if (input.interestedClassId) {
      const cls = await prisma.class.findFirst({ where: { id: input.interestedClassId, schoolId }, select: { id: true } });
      if (!cls) return NextResponse.json({ error: "That class was not found." }, { status: 404 });
    }
    if (input.assignedToId) {
      const staff = await prisma.staff.findFirst({ where: { id: input.assignedToId, schoolId }, select: { id: true } });
      if (!staff) return NextResponse.json({ error: "That staff member was not found." }, { status: 404 });
    }

    const enquiry = await prisma.$transaction(async (tx) => {
      const created = await tx.admissionEnquiry.create({
        data: {
          schoolId,
          parentName: input.parentName,
          parentPhone: input.parentPhone,
          parentEmail: input.parentEmail,
          childName: input.childName,
          childDob: input.childDob ? new Date(input.childDob) : undefined,
          interestedClassId: input.interestedClassId,
          source: input.source,
          followUpDate: input.followUpDate ? new Date(input.followUpDate) : undefined,
          assignedToId: input.assignedToId,
          notes: input.notes,
          createdById: user.id,
        },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "admissionEnquiry.create",
        entityType: "AdmissionEnquiry",
        entityId: created.id,
        after: { parentName: created.parentName, childName: created.childName },
      });
      return created;
    });

    return NextResponse.json(enquiry, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
