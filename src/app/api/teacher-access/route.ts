import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { getTeacherScope } from "@/lib/teacher-scope";
import { apiError } from "@/lib/api-error";

/**
 * Admin-facing overview of "who can see which students" — every teacher,
 * with the sections they're class teacher of (full roster + daily
 * attendance) and the class/subject combinations they hold a
 * SubjectAssignment for (attendance-only, that subject's periods).
 *
 * Read-only: the actual grants are made from School Management → Sections
 * (class teacher) and Subjects → a subject's "Classes & Sections" tab
 * (subject assignment) — this page exists so an admin can see the whole
 * picture in one place instead of re-deriving it from those two screens.
 */
export async function GET() {
  try {
    const user = await requirePermission("studentAttendance", "view");
    // This overview spans every teacher's scope — a teacher only ever sees
    // their own via /api/my/teaching-scope.
    if (user.role === "teacher") {
      return NextResponse.json({ error: "Not available for this role." }, { status: 403 });
    }

    const teachers = await prisma.staff.findMany({
      where: { schoolId: user.schoolId, category: "teacher", employmentStatus: "active" },
      select: { id: true, fullName: true, employeeId: true },
      orderBy: { fullName: "asc" },
    });

    const data = await Promise.all(
      teachers.map(async (teacher) => {
        const scope = await getTeacherScope(teacher.id, user.schoolId);
        return { ...teacher, ...scope };
      }),
    );

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
