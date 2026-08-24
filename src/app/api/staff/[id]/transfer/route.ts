import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity, describeChange } from "@/lib/audit";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

const transferSchema = z
  .object({
    toDepartmentId: z.string().trim().optional(),
    toDesignationId: z.string().trim().optional(),
    toCampusId: z.string().trim().optional(),
    toManagerId: z.string().trim().optional(),
    toWorkLocation: z.string().trim().max(150).optional(),
    reason: z.string().trim().max(500).optional(),
    effectiveDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid effective date"),
  })
  .refine(
    (v) => v.toDepartmentId || v.toDesignationId || v.toCampusId || v.toManagerId || v.toWorkLocation,
    { message: "Choose at least one thing to change", path: ["toDepartmentId"] },
  );

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("employees", "view");
    const { id } = await params;

    const data = await prisma.staffTransfer.findMany({
      where: { staffId: id, schoolId },
      orderBy: { effectiveDate: "desc" },
    });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Applies a transfer: writes an immutable StaffTransfer row capturing both the
 * old and new values, then updates Staff. The previous values are never
 * overwritten without being recorded first (spec §2.14).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("employees", "transfer");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.staff.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const input = cleanEmptyStrings(transferSchema.parse(await request.json()));

    if (input.toManagerId === id) {
      return NextResponse.json(
        { error: "Validation failed", fieldErrors: { toManagerId: ["An employee cannot report to themselves."] } },
        { status: 422 },
      );
    }

    const changed: { key: string; label: string; from: string | null; to: string }[] = [];
    if (input.toDepartmentId && input.toDepartmentId !== existing.departmentId)
      changed.push({ key: "department", label: "Department", from: existing.departmentId, to: input.toDepartmentId });
    if (input.toDesignationId && input.toDesignationId !== existing.designationId)
      changed.push({ key: "designation", label: "Designation", from: existing.designationId, to: input.toDesignationId });
    if (input.toCampusId && input.toCampusId !== existing.campusId)
      changed.push({ key: "campus", label: "Campus", from: existing.campusId, to: input.toCampusId });
    if (input.toManagerId && input.toManagerId !== existing.reportingManagerId)
      changed.push({ key: "manager", label: "Reporting manager", from: existing.reportingManagerId, to: input.toManagerId });
    if (input.toWorkLocation && input.toWorkLocation !== existing.workLocation)
      changed.push({ key: "location", label: "Work location", from: existing.workLocation, to: input.toWorkLocation });

    if (changed.length === 0) {
      return NextResponse.json({ error: "Nothing would change with this transfer." }, { status: 422 });
    }

    const transferType = changed.length > 1 ? "multiple" : changed[0].key;

    // Resolve ids to names once, so the timeline reads "Academics → Finance"
    // rather than two opaque cuids.
    const [departments, designations, campuses, managers] = await Promise.all([
      prisma.department.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      prisma.designation.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      prisma.campus.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      prisma.staff.findMany({ where: { schoolId }, select: { id: true, fullName: true } }),
    ]);
    const nameLookup = new Map<string, string>([
      ...departments.map((d) => [d.id, d.name] as const),
      ...designations.map((d) => [d.id, d.name] as const),
      ...campuses.map((c) => [c.id, c.name] as const),
      ...managers.map((m) => [m.id, m.fullName] as const),
    ]);
    const nameOf = (id: string | null) => (id ? (nameLookup.get(id) ?? id) : null);

    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.staffTransfer.create({
        data: {
          schoolId,
          staffId: id,
          transferType,
          fromDepartmentId: existing.departmentId,
          toDepartmentId: input.toDepartmentId,
          fromDesignationId: existing.designationId,
          toDesignationId: input.toDesignationId,
          fromCampusId: existing.campusId,
          toCampusId: input.toCampusId,
          fromManagerId: existing.reportingManagerId,
          toManagerId: input.toManagerId,
          fromWorkLocation: existing.workLocation,
          toWorkLocation: input.toWorkLocation,
          reason: input.reason,
          effectiveDate: new Date(input.effectiveDate),
          approvedById: user.id,
          appliedAt: new Date(),
          status: "applied",
        },
      });

      await tx.staff.update({
        where: { id },
        data: {
          ...(input.toDepartmentId && { departmentId: input.toDepartmentId }),
          ...(input.toDesignationId && { designationId: input.toDesignationId }),
          ...(input.toCampusId && { campusId: input.toCampusId }),
          ...(input.toManagerId && { reportingManagerId: input.toManagerId }),
          ...(input.toWorkLocation && { workLocation: input.toWorkLocation }),
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employee.transfer",
        entityType: "Staff",
        entityId: id,
        before: Object.fromEntries(changed.map((c) => [c.key, c.from])),
        after: Object.fromEntries(changed.map((c) => [c.key, c.to])),
      });

      for (const c of changed) {
        await recordStaffActivity(tx, {
          schoolId,
          staffId: id,
          type: "transferred",
          description: `${describeChange(c.label, nameOf(c.from), nameOf(c.to) ?? c.to)}${
            input.reason ? ` — ${input.reason}` : ""
          }`,
          actorId: user.id,
        });
      }

      return transfer;
    });

    return NextResponse.json({ success: true, transfer: result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
