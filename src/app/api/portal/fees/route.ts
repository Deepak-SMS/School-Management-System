import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { resolvePortalStudent } from "@/lib/portal-scope";
import { studentFeeChargeInclude, buildStudentFeeAccount } from "@/lib/student-fee-response";
import { apiError } from "@/lib/api-error";

/** A parent's own child's fee account — same computation as src/app/api/students/[id]/fees/route.ts (the admin equivalent). Parent-only, per the portal's access matrix. */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("studentFees", "view");
    if (user.role !== "parent") {
      return NextResponse.json({ error: "Fees are only visible to parents in the portal." }, { status: 403 });
    }
    const { studentId } = await resolvePortalStudent(request.nextUrl.searchParams.get("studentId"));

    const charges = await prisma.studentFeeCharge.findMany({
      where: { studentId },
      include: studentFeeChargeInclude,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(buildStudentFeeAccount(charges));
  } catch (error) {
    return apiError(error);
  }
}
