import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { hasPermission } from "@/config/permissions";
import { getCurrentStaff, getTeacherScope, canMarkHomeroom, canMarkSubject } from "@/lib/teacher-scope";
import { markAttendanceInputSchema } from "@/lib/validation/attendance";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** The server's local calendar date as "YYYY-MM-DD" — matches the date picker's own local-date logic on the client. */
function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Marks (or re-marks) attendance for a class/section on one date — daily
 * attendance if `subjectId` is omitted, that subject's period attendance if
 * it's set. No DB-level unique constraint backs this (see the Attendance
 * model's doc comment), so each record is an explicit find-then-write —
 * re-submitting the same date just updates it instead of duplicating.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("studentAttendance", "create");
    const input = markAttendanceInputSchema.parse(await request.json());
    const date = new Date(input.date);

    let markedById: string | undefined;
    if (user.role === "teacher") {
      const staff = await getCurrentStaff();
      markedById = staff.id;
      const scope = await getTeacherScope(staff.id, user.schoolId);
      const allowed = input.subjectId
        ? canMarkSubject(scope, input.classId, input.sectionId, input.subjectId)
        : canMarkHomeroom(scope, input.classId, input.sectionId);
      if (!allowed) {
        return NextResponse.json({ error: "You don't teach this class." }, { status: 403 });
      }
    }

    // Once a teacher submits, that class/section(+subject)/date is locked —
    // only someone with studentAttendance:edit (school_admin/principal/super_admin,
    // never a teacher, see src/config/permissions.ts) can write through it, and
    // doing so implicitly reopens the lock so the override is on record, not silent.
    const canBypassLock = hasPermission(user.role, "studentAttendance", "edit");
    const lock = await prisma.attendanceLock.findFirst({
      where: { schoolId: user.schoolId, classId: input.classId, sectionId: input.sectionId, subjectId: input.subjectId ?? null, date, isLocked: true },
    });
    if (lock && !canBypassLock) {
      return NextResponse.json(
        { error: "Attendance for this date has already been submitted and is locked. Ask your school admin to reopen it." },
        { status: 409 },
      );
    }

    // Every student must actually belong to this class/section — otherwise a
    // crafted studentId could plant an attendance row on someone else's roster.
    const validStudents = await prisma.student.findMany({
      where: {
        schoolId: user.schoolId,
        classId: input.classId,
        sectionId: input.sectionId,
        id: { in: input.records.map((r) => r.studentId) },
      },
      select: { id: true },
    });
    const validIds = new Set(validStudents.map((s) => s.id));
    const records = input.records.filter((r) => validIds.has(r.studentId));
    if (records.length === 0) {
      return NextResponse.json({ error: "None of the given students belong to this class/section." }, { status: 422 });
    }

    const section = await prisma.section.findFirst({
      where: { id: input.sectionId, schoolId: user.schoolId },
      select: { academicYearId: true, academicYear: { select: { startDate: true, endDate: true } } },
    });
    if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });

    // The date picker already keeps the UI within these bounds — this is the
    // server-side backstop so a crafted request can't mark a future date or
    // one outside the section's academic year.
    if (input.date > todayIso()) {
      return NextResponse.json({ error: "Attendance can't be marked for a future date." }, { status: 422 });
    }
    if (input.date < section.academicYear.startDate.toISOString().slice(0, 10) || input.date > section.academicYear.endDate.toISOString().slice(0, 10)) {
      return NextResponse.json({ error: "This date falls outside the academic year." }, { status: 422 });
    }

    const results = await prisma.$transaction(async (tx) => {
      const written = [];
      for (const record of records) {
        const existing = await tx.attendance.findFirst({
          where: {
            schoolId: user.schoolId,
            studentId: record.studentId,
            date,
            subjectId: input.subjectId ?? null,
          },
        });

        const row = existing
          ? await tx.attendance.update({
              where: { id: existing.id },
              data: { status: record.status, remarks: record.remarks, markedById },
            })
          : await tx.attendance.create({
              data: {
                schoolId: user.schoolId,
                studentId: record.studentId,
                classId: input.classId,
                sectionId: input.sectionId,
                subjectId: input.subjectId,
                academicYearId: section.academicYearId,
                date,
                status: record.status,
                remarks: record.remarks,
                markedById,
              },
            });
        written.push(row);
      }

      if (lock && canBypassLock) {
        await tx.attendanceLock.update({
          where: { id: lock.id },
          data: { isLocked: false, reopenedById: user.id, reopenedAt: new Date(), reopenReason: "Edited directly by an admin" },
        });
      }

      if (user.role === "teacher") {
        // SQLite treats every NULL as distinct in a unique index, so a
        // compound-key upsert on subjectId (nullable) can't be trusted —
        // same reason Attendance itself uses find-then-write. See that
        // model's doc comment.
        const existingLock = await tx.attendanceLock.findFirst({
          where: { schoolId: user.schoolId, classId: input.classId, sectionId: input.sectionId, subjectId: input.subjectId ?? null, date },
        });
        if (existingLock) {
          await tx.attendanceLock.update({
            where: { id: existingLock.id },
            data: { isLocked: true, lockedById: user.id, lockedAt: new Date(), reopenedById: null, reopenedAt: null, reopenReason: null },
          });
        } else {
          await tx.attendanceLock.create({
            data: {
              schoolId: user.schoolId,
              classId: input.classId,
              sectionId: input.sectionId,
              subjectId: input.subjectId ?? null,
              date,
              lockedById: user.id,
            },
          });
        }
      }

      await recordAudit(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: "attendance.mark",
        entityType: "Attendance",
        entityId: `${input.classId}:${input.sectionId}:${input.subjectId ?? "daily"}:${input.date}`,
        after: { count: written.length },
      });

      return written;
    });

    return NextResponse.json({ data: results, count: results.length, locked: user.role === "teacher" }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
