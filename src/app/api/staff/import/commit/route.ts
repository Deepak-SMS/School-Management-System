import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity } from "@/lib/audit";
import { createQrVerification } from "@/lib/qr-verification";
import { generateEmployeeId } from "@/lib/employee-id";
import { composeFullName, DEFAULT_EMPLOYMENT_STATUS } from "@/lib/validation/staff";
import { codeFromName } from "@/lib/validation/designation";
import { validateEmployeeRow } from "@/lib/employees/employee-import";
import { buildEmployeeImportContext } from "@/lib/employees/employee-import-context";
import type { RowError } from "@/lib/csv-import";
import { apiError } from "@/lib/api-error";

const commitSchema = z.object({
  /** Optional: forces every imported employee into one department, overriding the column. */
  departmentId: z.string().trim().optional(),
  rows: z
    .array(z.object({ lineNumber: z.number().int(), values: z.record(z.string(), z.string()) }))
    .min(1, "There is nothing to import")
    .max(2000),
});

/**
 * Step 2 of the employee import: create the staff records.
 *
 * Rows are re-validated here rather than trusted from the validate step, and the
 * whole batch runs in one transaction — so the import either lands completely or
 * not at all.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("employees", "import");
    const { schoolId } = user;
    const input = commitSchema.parse(await request.json());

    if (input.departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: input.departmentId, schoolId },
        select: { id: true },
      });
      if (!department) return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }

    const context = await buildEmployeeImportContext(schoolId);

    const errors: RowError[] = [];
    const seenInFile = new Set<string>();
    for (const row of input.rows) {
      errors.push(...validateEmployeeRow(row, context, seenInFile));
    }

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
          type: "staff",
          fileName: "employee-import.csv",
          status: "processing",
          totalRows: input.rows.length,
          createdBy: user.id,
        },
      });

      // Designations are created on demand, so a school doesn't have to pre-enter
      // every job title before importing. Cached to avoid re-querying per row.
      const designationIds = new Map<string, string>();
      async function resolveDesignation(name: string): Promise<string> {
        const key = name.toLowerCase();
        const cached = designationIds.get(key);
        if (cached) return cached;

        const code = codeFromName(name);
        const existing = await tx.designation.findFirst({ where: { schoolId, code } });
        const row =
          existing ??
          (await tx.designation.create({ data: { schoolId, name: name.trim(), code, level: 0, status: "active" } }));
        designationIds.set(key, row.id);
        return row.id;
      }

      let created = 0;
      for (const row of input.rows) {
        const v = row.values;
        const employeeId = blank(v.employeeId) ?? (await generateEmployeeId(tx, schoolId));
        const fullName = composeFullName({ firstName: v.firstName, middleName: v.middleName, lastName: v.lastName });

        // Explicit department override wins over the file's column.
        const departmentId =
          input.departmentId ?? (v.departmentName ? context.departments.get(v.departmentName.toLowerCase()) : undefined);

        const staff = await tx.staff.create({
          data: {
            schoolId,
            employeeId,
            fullName,
            firstName: blank(v.firstName),
            middleName: blank(v.middleName),
            lastName: blank(v.lastName),
            dateOfBirth: date(v.dateOfBirth),
            gender: lower(v.gender),
            bloodGroup: blank(v.bloodGroup),
            maritalStatus: lower(v.maritalStatus),
            category: lower(v.category) ?? "other",
            departmentId,
            designationId: v.designationName ? await resolveDesignation(v.designationName) : undefined,
            employeeTypeId: v.employeeTypeName
              ? context.employeeTypes.get(v.employeeTypeName.toLowerCase())
              : undefined,
            campusId: v.campusName ? context.campuses.get(v.campusName.toLowerCase()) : undefined,
            reportingManagerId: v.managerEmployeeId
              ? context.employeeIds.get(v.managerEmployeeId.toLowerCase())
              : undefined,
            workLocation: blank(v.workLocation),
            joiningDate: date(v.joiningDate),
            confirmationDate: date(v.confirmationDate),
            probationMonths: v.probationMonths ? Number(v.probationMonths) : undefined,
            employmentStatus: lower(v.employmentStatus) ?? DEFAULT_EMPLOYMENT_STATUS,
            mobileNumber: v.mobileNumber,
            alternateNumber: blank(v.alternateNumber),
            email: blank(v.email),
            officialEmail: blank(v.officialEmail),
            address: blank(v.address),
            city: blank(v.city),
            state: blank(v.state),
            country: blank(v.country),
            pinCode: blank(v.pinCode),
            emergencyName: blank(v.emergencyName),
            emergencyRelation: blank(v.emergencyRelation),
            emergencyContact: blank(v.emergencyContact),
          },
        });

        await createQrVerification(tx, { schoolId, staffId: staff.id });
        await recordStaffActivity(tx, {
          schoolId,
          staffId: staff.id,
          type: "created",
          description: `Employee record created by import (${employeeId})`,
          actorId: user.id,
        });

        // Newly created employees can be managers for later rows in the same file.
        context.employeeIds.set(employeeId.toLowerCase(), staff.id);
        created++;
      }

      await tx.importJob.update({
        where: { id: job.id },
        data: { status: "completed", validRows: created, errorRows: 0, completedAt: new Date() },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employee.import",
        entityType: "ImportJob",
        entityId: job.id,
        after: { imported: created, departmentId: input.departmentId ?? null },
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
