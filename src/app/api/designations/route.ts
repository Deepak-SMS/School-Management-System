import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  const schoolId = await getCurrentSchoolId();
  const q = request.nextUrl.searchParams.get("q")?.trim();

  const data = await prisma.designation.findMany({
    where: { schoolId, status: "active", ...(q && { name: { contains: q } }) },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data });
}

const designationInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  departmentId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const input = designationInputSchema.parse(await request.json());
    const code = input.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20) || "ROLE";

    const designation = await prisma.designation.create({
      data: { schoolId, name: input.name, code, departmentId: input.departmentId },
    });
    return NextResponse.json(designation, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
