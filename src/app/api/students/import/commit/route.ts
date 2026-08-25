import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { createQrVerification } from "@/lib/qr-verification";
import { validateRow, type ValidationContext, type RowError } from "@/lib/students/student-import";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const commitSchema = z.object({
  academicYearId: z.string().trim().min(1, "Academic year is required"),
  rows: z
    .array(z.object({ lineNumber: z.number().int(), values: z.record(z.string(), z.string()) }))
    .min(1, "There is nothing to import")
    .max(2000),
});

/**
 * Step 2 of the import: create the students.
 *
 * Rows are re-validated here rather than trusted from the validate step — the
 * client could have altered them, and the roster may have changed in between.
 * Everything runs in one transaction, so the import either lands completely or
 * not at all; a partial import is exactly what the spec warns against.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("students", "import");
    const { schoolId } = user;
    const input = commitSchema.parse(await request.json());

    const academicYear = await prisma.academicYear.findFirst({
      where: { id: input.academicYearId, schoolId },
      select: { id: true },
    });
    if (!academicYear) return NextResponse.json({ error: "Academic year not found." }, { status: 404 });

    const [classes, existing] = await Promise.all([
      prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, sections: { select: { id: true, name: true } } },
      }),
      prisma.student.findMany({ where: { schoolId }, select: { admissionNumber: true } }),
    ]);

    const context: ValidationContext = {
      classes: new Map(
        classes.map((c) => [
          c.name.toLowerCase(),
          { id: c.id, sections: new Map(c.sections.map((s) => [s.name.toLowerCase(), s.id])) },
        ]),
      ),
      existingAdmissionNumbers: new Set(existing.map((s) => s.admissionNumber.toLowerCase())),
    };

    const errors: RowError[] = [];
    const seenInFile = new Set<string>();
    for (const row of input.rows) {
      errors.push(...validateRow(row, context, seenInFile));
    }

    // Re-validation failed — refuse the whole batch rather than importing the
    // good rows and leaving the administrator to guess which were skipped.
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "Some rows are no longer valid, so nothing was imported. Re-check the file and try again.",
          errors: errors.slice(0, 100),
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.importJob.create({
        data: {
          schoolId,
          type: "students",
          fileName: "student-import.csv",
          status: "processing",
          totalRows: input.rows.length,
          createdBy: user.id,
        },
      });

      let created = 0;
      for (const row of input.rows) {
        const v = row.values;
        const cls = context.classes.get(v.className.toLowerCase())!;
        const sectionId = v.sectionName ? cls.sections.get(v.sectionName.toLowerCase()) : undefined;

        const student = await tx.student.create({
          data: {
            schoolId,
            academicYearId: academicYear.id,
            classId: cls.id,
            sectionId,
            admissionNumber: v.admissionNumber,
            enrollmentNumber: blank(v.enrollmentNumber),
            firstName: v.firstName,
            middleName: blank(v.middleName),
            lastName: v.lastName,
            dateOfBirth: date(v.dateOfBirth),
            gender: lower(v.gender),
            bloodGroup: blank(v.bloodGroup),
            nationality: blank(v.nationality),
            motherTongue: blank(v.motherTongue),
            category: blank(v.category),
            religion: blank(v.religion),
            rollNumber: blank(v.rollNumber),
            house: blank(v.house),
            status: lower(v.status) ?? "active",
            admissionDate: date(v.admissionDate),
            admissionType: lower(v.admissionType),
            previousSchool: blank(v.previousSchool),
            address: blank(v.address),
            addressLine2: blank(v.addressLine2),
            city: blank(v.city),
            state: blank(v.state),
            country: blank(v.country),
            pinCode: blank(v.pinCode),
            primaryMobile: blank(v.primaryMobile),
            studentEmail: blank(v.studentEmail),
            parentEmail: blank(v.parentEmail),
            whatsappNumber: blank(v.whatsappNumber),
            emergencyName: blank(v.emergencyName),
            emergencyRelation: blank(v.emergencyRelation),
            emergencyContact: blank(v.emergencyContact),
            guardians: { create: buildGuardians(schoolId, v) },
          },
        });

        await createQrVerification(tx, { schoolId, studentId: student.id });
        created++;
      }

      await tx.importJob.update({
        where: { id: job.id },
        data: { status: "completed", validRows: created, errorRows: 0, completedAt: new Date() },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "student.import",
        entityType: "ImportJob",
        entityId: job.id,
        after: { imported: created, academicYearId: academicYear.id },
      });

      return { jobId: job.id, created };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function lower(value: string | undefined): string | undefined {
  return blank(value)?.toLowerCase();
}

function date(value: string | undefined): Date | undefined {
  const trimmed = blank(value);
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Builds the guardian links for a row. Father and mother each become their own
 * Guardian record, and the row's "Primary Guardian" column decides which is the
 * main contact — defaulting to the father only when a mother isn't given.
 */
function buildGuardians(
  schoolId: string,
  v: Record<string, string>,
): Prisma.StudentGuardianCreateWithoutStudentInput[] {
  const links: Prisma.StudentGuardianCreateWithoutStudentInput[] = [];
  const primary = lower(v.primaryGuardian);

  const parents = [
    { relationship: "father", name: v.fatherName, mobile: v.fatherMobile, email: v.fatherEmail, occupation: v.fatherOccupation },
    { relationship: "mother", name: v.motherName, mobile: v.motherMobile, email: v.motherEmail, occupation: v.motherOccupation },
  ];

  const present = parents.filter((p) => blank(p.name));
  for (const [index, parent] of present.entries()) {
    const fullName = parent.name.trim();
    const [firstName, ...rest] = fullName.split(" ");

    links.push({
      relationship: parent.relationship,
      // Explicit choice wins; otherwise the first parent listed is primary.
      isPrimary: primary ? primary === parent.relationship : index === 0,
      isEmergencyContact: index === 0,
      isAuthorizedPickup: true,
      canReceiveAcademic: true,
      canReceiveFee: index === 0,
      sortOrder: index,
      guardian: {
        create: {
          schoolId,
          firstName,
          lastName: rest.join(" ") || null,
          fullName,
          mobile: blank(parent.mobile) ?? null,
          email: blank(parent.email) ?? null,
          occupation: blank(parent.occupation) ?? null,
        },
      },
    });
  }

  return links;
}
