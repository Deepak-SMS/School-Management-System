import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Turns an enquiry into an admission form link, reusing the existing
 * RegistrationForm mechanism rather than a second applicant-data capture flow.
 * Idempotent: re-calling this for an enquiry that already has a live link
 * returns that same link instead of minting a new one.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("admissionEnquiries", "convert");
    const { schoolId } = user;
    const { id } = await params;

    const enquiry = await prisma.admissionEnquiry.findFirst({ where: { id, schoolId } });
    if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });

    const existing = await prisma.registrationForm.findFirst({
      where: {
        enquiryId: id,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const form =
      existing ??
      (await prisma.$transaction(async (tx) => {
        const created = await tx.registrationForm.create({
          data: {
            schoolId,
            token: randomBytes(16).toString("hex"),
            title: `Admission form — ${enquiry.childName}`,
            academicYearId: null,
            classId: enquiry.interestedClassId,
            enquiryId: enquiry.id,
            createdById: user.id,
          },
        });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "admissionEnquiry.generateLink",
          entityType: "RegistrationForm",
          entityId: created.id,
          after: { enquiryId: enquiry.id, token: created.token },
        });
        return created;
      }));

    const origin = request.nextUrl.origin;
    return NextResponse.json({ token: form.token, url: `${origin}/register/${form.token}` });
  } catch (error) {
    return apiError(error);
  }
}
