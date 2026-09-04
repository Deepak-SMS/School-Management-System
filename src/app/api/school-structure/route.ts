import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";

/** Classes (with nested sections) + academic years for the current school — feeds Select dropdowns in the student/staff forms. */
export async function GET() {
  const schoolId = await getCurrentSchoolId();

  const [classes, academicYears] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      orderBy: { sortOrder: "asc" },
      include: { sections: { orderBy: { name: "asc" } } },
    }),
    prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: "desc" },
    }),
  ]);

  return NextResponse.json({
    classes,
    academicYears: academicYears.map((year) => ({ ...year, isCurrent: year.status === "active" })),
  });
}
