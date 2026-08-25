import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { createQrVerification } from "@/lib/qr-verification";
import {
  registrationReviewSchema,
  publicRegistrationSchema,
  type PublicRegistrationInput,
} from "@/lib/validation/student-registration";
import { apiError } from "@/lib/api-error";

/**
 * Approves or rejects a parent-submitted admission form.
 *
 * Approval is where untrusted input finally becomes a real record — so the
 * payload is re-validated against the same schema before anything is written,
 * and the school-owned fields (admission number, class, section) come from the
 * reviewing staff member, never from the submission.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("studentRegistrations", "approve");
    const { schoolId } = user;
    const { id } = await params;

    const submission = await prisma.studentRegistration.findFirst({ where: { id, schoolId } });
    if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

    if (submission.status !== "pending") {
      return NextResponse.json(
        { error: `This submission was already ${submission.status}.` },
        { status: 409 },
      );
    }

    const input = registrationReviewSchema.parse(await request.json());

    if (input.action === "reject") {
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.studentRegistration.update({
          where: { id },
          data: { status: "rejected", reviewNote: input.reviewNote, reviewedById: user.id, reviewedAt: new Date() },
        });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "studentRegistration.reject",
          entityType: "StudentRegistration",
          entityId: id,
          before: { status: "pending" },
          after: { status: "rejected", reviewNote: input.reviewNote },
        });
        return row;
      });
      return NextResponse.json({ success: true, status: updated.status });
    }

    // --- Approval ---

    // Re-parse rather than trusting what was stored: the row has sat in the
    // database since submission, and this is the moment it becomes real data.
    let payload: PublicRegistrationInput;
    try {
      payload = publicRegistrationSchema.parse(JSON.parse(submission.payloadJson));
    } catch {
      return NextResponse.json(
        { error: "This submission's data is incomplete or malformed and can't be approved automatically. Add the student manually instead." },
        { status: 422 },
      );
    }

    const [academicYear, cls] = await Promise.all([
      prisma.academicYear.findFirst({ where: { id: input.academicYearId!, schoolId }, select: { id: true } }),
      prisma.class.findFirst({ where: { id: input.classId!, schoolId }, select: { id: true } }),
    ]);
    if (!academicYear) return NextResponse.json({ error: "Academic year not found." }, { status: 404 });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    if (input.sectionId) {
      const section = await prisma.section.findFirst({
        where: { id: input.sectionId, schoolId, classId: cls.id },
        select: { id: true },
      });
      if (!section) {
        return NextResponse.json({ error: "That section doesn't belong to the selected class." }, { status: 422 });
      }
    }

    const duplicate = await prisma.student.findFirst({
      where: { schoolId, admissionNumber: input.admissionNumber! },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `A student with admission number "${input.admissionNumber}" already exists.` },
        { status: 409 },
      );
    }

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          schoolId,
          academicYearId: academicYear.id,
          classId: cls.id,
          sectionId: input.sectionId,
          admissionNumber: input.admissionNumber!,
          rollNumber: input.rollNumber,
          firstName: payload.firstName,
          middleName: payload.middleName,
          lastName: payload.lastName,
          dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : undefined,
          gender: payload.gender,
          bloodGroup: payload.bloodGroup,
          nationality: payload.nationality,
          motherTongue: payload.motherTongue,
          previousSchool: payload.previousSchool,
          admissionDate: new Date(),
          admissionType: "new",
          status: "active",
          address: payload.address,
          addressLine2: payload.addressLine2,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          pinCode: payload.pinCode,
          sameAsCurrent: payload.sameAsCurrent ?? true,
          permanentAddress: payload.permanentAddress,
          permanentCity: payload.permanentCity,
          permanentState: payload.permanentState,
          permanentCountry: payload.permanentCountry,
          permanentPinCode: payload.permanentPinCode,
          primaryMobile: payload.primaryMobile,
          secondaryMobile: payload.secondaryMobile,
          studentEmail: payload.studentEmail,
          parentEmail: payload.parentEmail,
          whatsappNumber: payload.whatsappNumber,
          commChannelsJson: payload.commChannels ? JSON.stringify(payload.commChannels) : undefined,
          emergencyName: payload.emergencyName,
          emergencyRelation: payload.emergencyRelation,
          emergencyContact: payload.emergencyContact,
          emergencyAltPhone: payload.emergencyAltPhone,
          emergencyAddress: payload.emergencyAddress,
          guardians: {
            create: payload.guardians.map((g, index) => {
              const [firstName, ...rest] = g.fullName.trim().split(" ");
              return {
                relationship: g.relationship,
                isPrimary: g.isPrimary ?? index === 0,
                isEmergencyContact: g.isEmergencyContact ?? index === 0,
                isAuthorizedPickup: g.isAuthorizedPickup ?? true,
                canReceiveAcademic: true,
                canReceiveFee: index === 0,
                sortOrder: index,
                guardian: {
                  create: {
                    schoolId,
                    firstName,
                    lastName: rest.join(" ") || null,
                    fullName: g.fullName.trim(),
                    mobile: g.mobile ?? null,
                    alternateMobile: g.alternateMobile ?? null,
                    email: g.email ?? null,
                    occupation: g.occupation ?? null,
                    organization: g.organization ?? null,
                    designation: g.designation ?? null,
                    education: g.education ?? null,
                  },
                },
              };
            }),
          },
        },
      });

      await createQrVerification(tx, { schoolId, studentId: created.id });

      await tx.studentRegistration.update({
        where: { id },
        data: {
          status: "approved",
          reviewNote: input.reviewNote,
          reviewedById: user.id,
          reviewedAt: new Date(),
          studentId: created.id,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "studentRegistration.approve",
        entityType: "Student",
        entityId: created.id,
        before: { registrationId: id, status: "pending" },
        after: { studentId: created.id, admissionNumber: created.admissionNumber },
      });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        status: "approved",
        studentId: student.id,
        admissionNumber: student.admissionNumber,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
