import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { admissionEnquiryInputSchema } from "@/lib/validation/admission-enquiry";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("admissionEnquiries", "view");
    const { id } = await params;

    const enquiry = await prisma.admissionEnquiry.findFirst({
      where: { id, schoolId },
      include: {
        interestedClass: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true } },
        forms: { select: { id: true, token: true, isActive: true, expiresAt: true } },
      },
    });
    if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });

    return NextResponse.json(enquiry);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("admissionEnquiries", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const body = await request.json();

    if (body?.status === "converted") {
      return NextResponse.json(
        { error: "Converted automatically once an application is submitted." },
        { status: 422 },
      );
    }

    const input = cleanEmptyStrings(admissionEnquiryInputSchema.partial().parse(body));

    const existing = await prisma.admissionEnquiry.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });

    if (input.interestedClassId) {
      const cls = await prisma.class.findFirst({ where: { id: input.interestedClassId, schoolId }, select: { id: true } });
      if (!cls) return NextResponse.json({ error: "That class was not found." }, { status: 404 });
    }
    if (input.assignedToId) {
      const staff = await prisma.staff.findFirst({ where: { id: input.assignedToId, schoolId }, select: { id: true } });
      if (!staff) return NextResponse.json({ error: "That staff member was not found." }, { status: 404 });
    }

    const enquiry = await prisma.$transaction(async (tx) => {
      const updated = await tx.admissionEnquiry.update({
        where: { id },
        data: {
          ...input,
          childDob: input.childDob ? new Date(input.childDob) : undefined,
          followUpDate: input.followUpDate ? new Date(input.followUpDate) : undefined,
        },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "admissionEnquiry.update",
        entityType: "AdmissionEnquiry",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(enquiry);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("admissionEnquiries", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.admissionEnquiry.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });

    const registrationCount = await prisma.studentRegistration.count({ where: { enquiryId: id } });
    if (registrationCount > 0) {
      return NextResponse.json(
        { error: "This enquiry already has a submitted application and can't be deleted." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.admissionEnquiry.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "admissionEnquiry.delete",
        entityType: "AdmissionEnquiry",
        entityId: id,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
