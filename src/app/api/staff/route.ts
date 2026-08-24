import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  staffInputSchema,
  composeFullName,
  SENSITIVE_STAFF_INPUT_KEYS,
  DEFAULT_EMPLOYMENT_STATUS,
} from "@/lib/validation/staff";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { createQrVerification } from "@/lib/qr-verification";
import { requirePermission, redactSensitivePayList } from "@/lib/authorize";
import { hasPermission } from "@/config/permissions";
import { recordAudit, recordStaffActivity } from "@/lib/audit";
import { generateEmployeeId } from "@/lib/employee-id";
import { ACTIVE_EMPLOYMENT_STATUSES } from "@/lib/constants/hr";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** Columns the list view may sort by — an allowlist so the param can't reach arbitrary fields. */
const SORTABLE = ["fullName", "employeeId", "joiningDate", "employmentStatus", "createdAt"] as const;
type SortableColumn = (typeof SORTABLE)[number];

function parseSort(value: string | null): SortableColumn {
  return (SORTABLE as readonly string[]).includes(value ?? "") ? (value as SortableColumn) : "fullName";
}

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("employees", "view");
    const { schoolId } = user;
    const params = request.nextUrl.searchParams;

    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const sortBy = parseSort(params.get("sortBy"));
    const sortDir = params.get("sortDir") === "desc" ? "desc" : "asc";

    const category = params.get("category") ?? undefined;
    const employmentStatus = params.get("employmentStatus") ?? undefined;
    const departmentId = params.get("departmentId") ?? undefined;
    const designationId = params.get("designationId") ?? undefined;
    const employeeTypeId = params.get("employeeTypeId") ?? undefined;
    const campusId = params.get("campusId") ?? undefined;
    const gender = params.get("gender") ?? undefined;
    const reportingManagerId = params.get("reportingManagerId") ?? undefined;
    const joinedFrom = params.get("joinedFrom");
    const joinedTo = params.get("joinedTo");
    /** `employed=true` collapses the "currently employed" statuses into one filter. */
    const employedOnly = params.get("employed") === "true";
    /** `probation=true` surfaces everyone still inside their probation window. */
    const probationOnly = params.get("probation") === "true";

    const where: Prisma.StaffWhereInput = {
      schoolId,
      ...(category && { category }),
      ...(employmentStatus && { employmentStatus }),
      ...(employedOnly && { employmentStatus: { in: [...ACTIVE_EMPLOYMENT_STATUSES] } }),
      ...(probationOnly && { employmentStatus: "probation" }),
      ...(departmentId && { departmentId }),
      ...(designationId && { designationId }),
      ...(employeeTypeId && { employeeTypeId }),
      ...(campusId && { campusId }),
      ...(gender && { gender }),
      ...(reportingManagerId && { reportingManagerId }),
      ...((joinedFrom || joinedTo) && {
        joiningDate: {
          ...(joinedFrom && { gte: new Date(joinedFrom) }),
          ...(joinedTo && { lte: new Date(joinedTo) }),
        },
      }),
      ...(q && {
        OR: [
          { fullName: { contains: q } },
          { employeeId: { contains: q } },
          { mobileNumber: { contains: q } },
          { email: { contains: q } },
          { officialEmail: { contains: q } },
          { designation: { name: { contains: q } } },
          { department: { name: { contains: q } } },
        ],
      }),
    };

    // A HOD only ever sees their own department's staff, regardless of filters.
    if (user.role === "hod" && user.id) {
      const managed = await prisma.department.findMany({
        where: { schoolId, head: { id: user.id } },
        select: { id: true },
      });
      where.departmentId = { in: managed.map((d) => d.id) };
    }

    const [rows, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          campus: { select: { id: true, name: true } },
          employeeTypeRef: { select: { id: true, name: true } },
          reportingManager: { select: { id: true, fullName: true } },
        },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.staff.count({ where }),
    ]);

    // `designation` is flattened to a string for the many existing consumers that
    // expect that shape; the id travels alongside for filter round-tripping.
    const shaped = rows.map(({ designation, employeeTypeRef, ...rest }) => ({
      ...rest,
      designation: designation?.name ?? "",
      designationId: designation?.id ?? null,
      employeeType: employeeTypeRef?.name ?? null,
      employeeTypeId: employeeTypeRef?.id ?? null,
    }));

    return NextResponse.json({
      data: redactSensitivePayList(shaped, user),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("employees", "create");
    const { schoolId } = user;
    const body = await request.json();
    const input = cleanEmptyStrings(staffInputSchema.parse(body));

    // Writing pay data needs its own grant — silently dropping it would hide a
    // permission failure from the caller, so this is an explicit 403 instead.
    const sentSensitive = SENSITIVE_STAFF_INPUT_KEYS.some((k) => input[k] !== undefined);
    if (sentSensitive) await requirePermission("employeeSalary", "edit");

    const fullName = composeFullName(input);

    const staff = await prisma.$transaction(async (tx) => {
      // Blank employee ID means "generate one" (spec §2.6: auto-generate if configured).
      const employeeId = input.employeeId?.trim() || (await generateEmployeeId(tx, schoolId));

      const created = await tx.staff.create({
        data: {
          schoolId,
          employeeId,
          fullName,
          firstName: input.firstName,
          middleName: input.middleName,
          lastName: input.lastName,
          preferredName: input.preferredName,
          photoUrl: input.photoUrl,
          photoFileId: input.photoFileId,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          gender: input.gender,
          bloodGroup: input.bloodGroup,
          maritalStatus: input.maritalStatus,
          mobileNumber: input.mobileNumber,
          alternateNumber: input.alternateNumber,
          email: input.email,
          officialEmail: input.officialEmail,
          address: input.address,
          permanentAddress: input.permanentAddress,
          city: input.city,
          state: input.state,
          country: input.country,
          pinCode: input.pinCode,
          emergencyName: input.emergencyName,
          emergencyRelation: input.emergencyRelation,
          emergencyContact: input.emergencyContact,
          emergencyAddress: input.emergencyAddress,
          category: input.category,
          designationId: input.designationId,
          departmentId: input.departmentId,
          campusId: input.campusId,
          employeeTypeId: input.employeeTypeId,
          reportingManagerId: input.reportingManagerId,
          workLocation: input.workLocation,
          joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
          confirmationDate: input.confirmationDate ? new Date(input.confirmationDate) : undefined,
          probationEndDate: input.probationEndDate ? new Date(input.probationEndDate) : undefined,
          probationMonths: input.probationMonths,
          employmentStatus: input.employmentStatus ?? DEFAULT_EMPLOYMENT_STATUS,
          panNumber: input.panNumber,
          bankName: input.bankName,
          bankAccountNumber: input.bankAccountNumber,
          bankIfsc: input.bankIfsc,
          bankAccountHolder: input.bankAccountHolder,
          pfNumber: input.pfNumber,
          esicNumber: input.esicNumber,
        },
      });

      await createQrVerification(tx, { schoolId, staffId: created.id });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employee.create",
        entityType: "Staff",
        entityId: created.id,
        after: { employeeId: created.employeeId, fullName: created.fullName },
      });
      await recordStaffActivity(tx, {
        schoolId,
        staffId: created.id,
        type: "created",
        description: `Employee record created (${created.employeeId})`,
        actorId: user.id,
      });

      return created;
    });

    const canSeePay = hasPermission(user.role, "employeeSalary", "view");
    return NextResponse.json(canSeePay ? staff : redactSensitivePayList([staff], user)[0], { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
