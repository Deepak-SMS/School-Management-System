import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** The review queue for parent-submitted admission forms. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("studentRegistrations", "view");
    const params = request.nextUrl.searchParams;
    const status = params.get("status") ?? "pending";
    const q = params.get("q")?.trim();

    const where: Prisma.StudentRegistrationWhereInput = {
      schoolId,
      ...(status !== "all" && { status }),
      ...(q && {
        OR: [
          { studentName: { contains: q } },
          { contactPhone: { contains: q } },
          { contactEmail: { contains: q } },
        ],
      }),
    };

    const [data, pendingCount] = await Promise.all([
      prisma.studentRegistration.findMany({
        where,
        include: {
          form: { select: { id: true, title: true } },
          student: { select: { id: true, admissionNumber: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 200,
      }),
      prisma.studentRegistration.count({ where: { schoolId, status: "pending" } }),
    ]);

    // payloadJson is parsed here so the client never has to; it stays untrusted
    // display data either way.
    const shaped = data.map((row) => ({
      ...row,
      payload: safeParse(row.payloadJson),
      payloadJson: undefined,
    }));

    return NextResponse.json({ data: shaped, pendingCount, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
