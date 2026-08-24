import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";

/** Read-only: staff assigned to this department, for the Department detail page's Employees/Teachers tabs. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;

  const department = await prisma.department.findFirst({ where: { id, schoolId } });
  if (!department) return NextResponse.json({ error: "Department not found." }, { status: 404 });

  const staff = await prisma.staff.findMany({
    where: { schoolId, departmentId: id },
    select: {
      id: true,
      fullName: true,
      employeeId: true,
      designation: { select: { name: true } },
      category: true,
      employmentStatus: true,
    },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({
    data: staff.map(({ designation, ...rest }) => ({ ...rest, designation: designation?.name ?? "" })),
  });
}
