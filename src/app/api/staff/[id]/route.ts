import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { staffInputSchema, composeFullName, SENSITIVE_STAFF_INPUT_KEYS } from "@/lib/validation/staff";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission, redactSensitivePay } from "@/lib/authorize";
import { recordAudit, recordStaffActivity, describeChange } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const DETAIL_INCLUDE = {
  qrVerification: true,
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  campus: { select: { id: true, name: true } },
  employeeTypeRef: { select: { id: true, name: true } },
  reportingManager: { select: { id: true, fullName: true, employeeId: true } },
  educations: { orderBy: { passingYear: "desc" } },
  experiences: { orderBy: { startDate: "desc" } },
} as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("employees", "view");
    const { id } = await params;

    const staff = await prisma.staff.findFirst({
      where: { id, schoolId: user.schoolId },
      include: DETAIL_INCLUDE,
    });
    if (!staff) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const { designation, employeeTypeRef, ...rest } = staff;
    const shaped = {
      ...rest,
      designation: designation?.name ?? "",
      designationId: designation?.id ?? null,
      employeeType: employeeTypeRef?.name ?? null,
      employeeTypeId: employeeTypeRef?.id ?? null,
    };

    return NextResponse.json(redactSensitivePay(shaped, user));
  } catch (error) {
    return apiError(error);
  }
}

/** Fields whose change is worth a line on the employee's activity timeline. */
const TRACKED_FIELDS = [
  { key: "departmentId", label: "Department" },
  { key: "designationId", label: "Designation" },
  { key: "campusId", label: "Campus" },
  { key: "employeeTypeId", label: "Employee type" },
  { key: "employmentStatus", label: "Employment status" },
  { key: "reportingManagerId", label: "Reporting manager" },
  { key: "workLocation", label: "Work location" },
] as const;

const ACTIVITY_TYPE_BY_FIELD: Record<string, string> = {
  departmentId: "department_changed",
  designationId: "designation_changed",
  employmentStatus: "status_changed",
};

/**
 * Builds a lookup that turns relation ids into display names for the activity
 * timeline. Only the tables actually involved in this edit are queried.
 */
async function buildLabelResolver(
  tx: Prisma.TransactionClient,
  schoolId: string,
  changedKeys: string[],
): Promise<(key: string, value: unknown) => unknown> {
  const names = new Map<string, string>();

  const load = async (rows: { id: string; name: string }[]) => {
    for (const row of rows) names.set(row.id, row.name);
  };

  await Promise.all([
    changedKeys.includes("departmentId")
      ? tx.department.findMany({ where: { schoolId }, select: { id: true, name: true } }).then(load)
      : null,
    changedKeys.includes("designationId")
      ? tx.designation.findMany({ where: { schoolId }, select: { id: true, name: true } }).then(load)
      : null,
    changedKeys.includes("campusId")
      ? tx.campus.findMany({ where: { schoolId }, select: { id: true, name: true } }).then(load)
      : null,
    changedKeys.includes("employeeTypeId")
      ? tx.employeeType.findMany({ where: { schoolId }, select: { id: true, name: true } }).then(load)
      : null,
    changedKeys.includes("reportingManagerId")
      ? tx.staff
          .findMany({ where: { schoolId }, select: { id: true, fullName: true } })
          .then((rows) => load(rows.map((r) => ({ id: r.id, name: r.fullName }))))
      : null,
  ]);

  return (key, value) => {
    if (typeof value !== "string" || !key.endsWith("Id")) return value;
    return names.get(value) ?? value;
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("employees", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(staffInputSchema.partial().parse(body));

    // Writing pay data needs its own grant — an explicit 403 rather than
    // silently dropping the fields, so the caller learns the write didn't happen.
    const sentSensitive = SENSITIVE_STAFF_INPUT_KEYS.some((k) => input[k] !== undefined);
    if (sentSensitive) await requirePermission("employeeSalary", "edit");

    const existing = await prisma.staff.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const nameTouched =
        input.firstName !== undefined || input.middleName !== undefined || input.lastName !== undefined;

      const staff = await tx.staff.update({
        where: { id },
        data: {
          ...input,
          // Keep the derived display name in step with its parts.
          ...(nameTouched && {
            fullName: composeFullName({
              firstName: input.firstName ?? existing.firstName,
              middleName: input.middleName ?? existing.middleName,
              lastName: input.lastName ?? existing.lastName,
            }),
          }),
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
          confirmationDate: input.confirmationDate ? new Date(input.confirmationDate) : undefined,
          probationEndDate: input.probationEndDate ? new Date(input.probationEndDate) : undefined,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employee.update",
        entityType: "Staff",
        entityId: id,
        before: existing,
        after: staff,
      });

      // One timeline entry per meaningful field change, so the Activity tab reads
      // as history rather than a single opaque "profile updated".
      const changes = TRACKED_FIELDS.filter(
        ({ key }) =>
          input[key as keyof typeof input] !== undefined &&
          existing[key as keyof typeof existing] !== staff[key as keyof typeof staff],
      );

      // Relation columns hold ids; the timeline is read by people, so resolve
      // them to names before writing the entry.
      const label = await buildLabelResolver(tx, schoolId, changes.map((c) => c.key));

      for (const { key, label: fieldLabel } of changes) {
        await recordStaffActivity(tx, {
          schoolId,
          staffId: id,
          type: ACTIVITY_TYPE_BY_FIELD[key] ?? "profile_updated",
          description: describeChange(
            fieldLabel,
            label(key, existing[key as keyof typeof existing]),
            label(key, staff[key as keyof typeof staff]),
          ),
          actorId: user.id,
        });
      }

      if (changes.length === 0) {
        await recordStaffActivity(tx, {
          schoolId,
          staffId: id,
          type: "profile_updated",
          description: "Profile details updated",
          actorId: user.id,
        });
      }

      return staff;
    });

    return NextResponse.json(redactSensitivePay(updated, user));
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Deactivation, not deletion. Employment history must survive for payroll, audit
 * and legal reporting (spec §2.15), so this sets an inactive employment status
 * and records why, rather than removing the row.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("employees", "deactivate");
    const { schoolId } = user;
    const { id } = await params;
    const status = request.nextUrl.searchParams.get("status") ?? "inactive";
    const reason = request.nextUrl.searchParams.get("reason") ?? undefined;

    const existing = await prisma.staff.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const staff = await prisma.$transaction(async (tx) => {
      const updated = await tx.staff.update({ where: { id }, data: { employmentStatus: status } });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employee.deactivate",
        entityType: "Staff",
        entityId: id,
        before: { employmentStatus: existing.employmentStatus },
        after: { employmentStatus: status, reason },
      });
      await recordStaffActivity(tx, {
        schoolId,
        staffId: id,
        type: "status_changed",
        description: `${describeChange("Employment status", existing.employmentStatus, status)}${
          reason ? ` — ${reason}` : ""
        }`,
        actorId: user.id,
      });

      return updated;
    });

    return NextResponse.json({ success: true, employmentStatus: staff.employmentStatus });
  } catch (error) {
    return apiError(error);
  }
}
