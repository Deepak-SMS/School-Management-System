import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getCurrentGuardian, getCurrentStudentSelf, getPortalChildrenForGuardian } from "@/lib/portal-scope";
import { apiError } from "@/lib/api-error";
import type { PortalChild } from "@/types/portal";

/** The children a signed-in portal user may switch between — a parent's linked children, or just themself for a student. */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (user.role === "student") {
      const self = await getCurrentStudentSelf();
      const student = await prisma.student.findUniqueOrThrow({
        where: { id: self.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          classId: true,
          class: { select: { name: true } },
          sectionId: true,
          section: { select: { name: true } },
        },
      });
      const children: PortalChild[] = [
        {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          photoUrl: student.photoUrl,
          classId: student.classId,
          className: student.class.name,
          sectionId: student.sectionId,
          sectionName: student.section?.name ?? null,
        },
      ];
      return NextResponse.json({ data: children });
    }

    const guardian = await getCurrentGuardian();
    const children = await getPortalChildrenForGuardian(guardian);
    return NextResponse.json({ data: children });
  } catch (error) {
    return apiError(error);
  }
}
