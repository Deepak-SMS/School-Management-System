import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { getCurrentStaff, getTeacherScope, canMarkHomeroom, canMarkSubject } from "@/lib/teacher-scope";
import { apiError } from "@/lib/api-error";

/**
 * Roster for one class/section, for the signed-in teacher.
 *
 * Homeroom view (no `subjectId`): the fuller student record — this is the
 * class teacher's own class. Subject view (`subjectId` set): just enough to
 * take attendance for that period, nothing else — a subject teacher never
 * sees guardian contact details for a class that isn't theirs to manage.
 * (Both fetch the same columns; the subject view just doesn't return them —
 * simpler than two Prisma `select` shapes, and no more data leaves the server
 * either way.)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("studentAttendance", "view");
    const params = request.nextUrl.searchParams;
    const classId = params.get("classId");
    const sectionId = params.get("sectionId");
    const subjectId = params.get("subjectId") ?? undefined;
    const date = params.get("date");

    if (!classId || !sectionId || !date) {
      return NextResponse.json({ error: "classId, sectionId, and date are required." }, { status: 400 });
    }

    if (user.role === "teacher") {
      const staff = await getCurrentStaff();
      const scope = await getTeacherScope(staff.id, user.schoolId);
      const allowed = subjectId
        ? canMarkSubject(scope, classId, sectionId, subjectId)
        : canMarkHomeroom(scope, classId, sectionId);
      if (!allowed) {
        return NextResponse.json({ error: "You don't teach this class." }, { status: 403 });
      }
    }

    const students = await prisma.student.findMany({
      where: { schoolId: user.schoolId, classId, sectionId, status: "active" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rollNumber: true,
        admissionNumber: true,
        photoUrl: true,
        gender: true,
        guardians: {
          where: { isPrimary: true },
          take: 1,
          select: { guardian: { select: { mobile: true } } },
        },
      },
      orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
    });

    const attendance = await prisma.attendance.findMany({
      where: {
        schoolId: user.schoolId,
        classId,
        sectionId,
        subjectId: subjectId ?? null,
        date: new Date(date),
      },
      select: { studentId: true, status: true, remarks: true },
    });
    const attendanceByStudent = new Map(attendance.map((a) => [a.studentId, a]));

    const lock = await prisma.attendanceLock.findFirst({
      where: { schoolId: user.schoolId, classId, sectionId, subjectId: subjectId ?? null, date: new Date(date), isLocked: true },
      select: { lockedAt: true },
    });

    // Limited view: a subject teacher gets name/roll/admission no + attendance
    // only. Homeroom view: the class teacher also gets photo, gender, and the
    // primary guardian's mobile.
    const data = students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      rollNumber: s.rollNumber,
      admissionNumber: s.admissionNumber,
      ...(subjectId
        ? {}
        : {
            photoUrl: s.photoUrl,
            gender: s.gender,
            parentMobile: s.guardians[0]?.guardian.mobile ?? null,
          }),
      attendance: attendanceByStudent.get(s.id) ?? null,
    }));

    return NextResponse.json({ data, locked: Boolean(lock), lockedAt: lock?.lockedAt ?? null });
  } catch (error) {
    return apiError(error);
  }
}
