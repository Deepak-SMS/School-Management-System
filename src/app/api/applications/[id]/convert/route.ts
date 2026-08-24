import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { conversionInputSchema } from "@/lib/validation/recruitment";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { composeFullName } from "@/lib/validation/staff";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity } from "@/lib/audit";
import { generateEmployeeId } from "@/lib/employee-id";
import { createQrVerification } from "@/lib/qr-verification";
import { canConvertToEmployee } from "@/lib/recruitment-pipeline";
import type { ApplicationStatus } from "@/lib/constants/hr";
import { apiError } from "@/lib/api-error";

/**
 * Turns an accepted candidate into an employee — the hand-off from recruitment
 * to HR (spec §3.16).
 *
 * Everything happens in one transaction: create the Staff record from the terms
 * agreed at selection/offer, generate the employee id and QR identity, mark the
 * application `joined`, and link the candidate to the new staff row.
 *
 * The candidate record is kept and linked rather than copied away, so the
 * recruitment history stays intact and no duplicate person record is created.
 * A second call is refused because `convertedStaffId` is already set.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("candidates", "convert");
    const { schoolId } = user;
    const { id } = await params;

    const application = await prisma.application.findFirst({
      where: { id, schoolId },
      include: {
        candidate: true,
        vacancy: { select: { id: true, title: true, departmentId: true, designationId: true, campusId: true, employeeTypeId: true } },
        offers: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    const status = application.status as ApplicationStatus;
    if (!canConvertToEmployee(status)) {
      return NextResponse.json(
        { error: `Only a selected or offered candidate can be converted — this one is "${status}".` },
        { status: 409 },
      );
    }

    if (application.candidate.convertedStaffId) {
      return NextResponse.json(
        {
          error: "This candidate has already been converted to an employee.",
          staffId: application.candidate.convertedStaffId,
        },
        { status: 409 },
      );
    }

    const offer = application.offers[0];
    if (offer && offer.status !== "accepted") {
      return NextResponse.json(
        { error: `The offer is "${offer.status}". Mark it accepted before converting the candidate.` },
        { status: 409 },
      );
    }

    const input = cleanEmptyStrings(conversionInputSchema.parse(await request.json().catch(() => ({}))));
    const candidate = application.candidate;

    // Terms cascade: explicit override > offer > terms agreed at selection > vacancy.
    const departmentId =
      input.departmentId ?? offer?.departmentId ?? application.proposedDepartmentId ?? application.vacancy.departmentId ?? undefined;
    const designationId =
      input.designationId ?? offer?.designationId ?? application.proposedDesignationId ?? application.vacancy.designationId ?? undefined;
    const campusId =
      input.campusId ?? offer?.campusId ?? application.proposedCampusId ?? application.vacancy.campusId ?? undefined;
    const employeeTypeId = input.employeeTypeId ?? offer?.employeeTypeId ?? application.vacancy.employeeTypeId ?? undefined;
    const reportingManagerId = input.reportingManagerId ?? offer?.reportingManagerId ?? application.proposedManagerId ?? undefined;
    const joiningDateRaw = input.joiningDate ?? offer?.joiningDate ?? application.proposedJoiningDate ?? null;
    const joiningDate = joiningDateRaw ? new Date(joiningDateRaw) : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const employeeId = input.employeeId?.trim() || (await generateEmployeeId(tx, schoolId));
      const fullName = composeFullName({ firstName: candidate.firstName, lastName: candidate.lastName });

      const staff = await tx.staff.create({
        data: {
          schoolId,
          employeeId,
          fullName,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          mobileNumber: candidate.phone ?? "",
          photoFileId: candidate.photoFileId,
          address: candidate.address,
          city: candidate.city,
          state: candidate.state,
          country: candidate.country,
          pinCode: candidate.pinCode,
          category: input.category ?? "teacher",
          departmentId,
          designationId,
          campusId,
          employeeTypeId,
          reportingManagerId,
          workLocation: offer?.workLocation ?? undefined,
          joiningDate,
          // New hires start on probation; HR confirms them later.
          employmentStatus: "probation",
        },
      });

      await createQrVerification(tx, { schoolId, staffId: staff.id });

      // Carry the candidate's qualification across as their first education row,
      // so the new profile isn't empty on day one.
      if (candidate.highestQualification) {
        await tx.staffEducation.create({
          data: {
            staffId: staff.id,
            degree: candidate.highestQualification,
            institution: candidate.university,
            passingYear: candidate.passingYear,
          },
        });
      }

      // ...and their current role as prior experience.
      if (candidate.currentOrganization) {
        await tx.staffExperience.create({
          data: {
            staffId: staff.id,
            organization: candidate.currentOrganization,
            designation: candidate.currentDesignation,
            endDate: joiningDate,
          },
        });
      }

      // Link, don't copy: the candidate row stays as the recruitment record.
      await tx.candidate.update({ where: { id: candidate.id }, data: { convertedStaffId: staff.id } });

      await tx.application.update({ where: { id }, data: { status: "joined" } });
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: status,
          toStatus: "joined",
          note: `Converted to employee ${employeeId}`,
          actorId: user.id,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "candidate.convert_to_employee",
        entityType: "Staff",
        entityId: staff.id,
        before: { candidateId: candidate.id, applicationId: id, status },
        after: { staffId: staff.id, employeeId, status: "joined" },
      });

      await recordStaffActivity(tx, {
        schoolId,
        staffId: staff.id,
        type: "converted_from_candidate",
        description: `Joined from recruitment — ${application.vacancy.title} (${employeeId})`,
        actorId: user.id,
      });

      return staff;
    });

    return NextResponse.json(
      { success: true, staffId: result.id, employeeId: result.employeeId, fullName: result.fullName },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
