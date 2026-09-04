import { prisma } from "@/lib/db";
import { requireSessionUserId } from "@/lib/session";
import { getCurrentSchoolId } from "@/lib/tenant";

export class NotATeacherError extends Error {
  constructor() {
    super("This account is not linked to a staff record.");
    this.name = "NotATeacherError";
  }
}

/** Resolves the Staff record linked to the signed-in user, within their current school. */
export async function getCurrentStaff() {
  const [userId, schoolId] = await Promise.all([requireSessionUserId(), getCurrentSchoolId()]);
  const staff = await prisma.staff.findFirst({ where: { userId, schoolId } });
  if (!staff) throw new NotATeacherError();
  return staff;
}

export interface HomeroomScope {
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
}

export interface SubjectScope {
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
}

export interface TeacherScope {
  homerooms: HomeroomScope[];
  subjectClasses: SubjectScope[];
}

/**
 * Everything a teacher may see/mark attendance for:
 * - `homerooms`: sections where they are the class teacher — full roster access.
 * - `subjectClasses`: class/section + subject combinations from their
 *   SubjectAssignment rows — limited to that one subject's periods. An
 *   assignment with `sectionId = null` ("whole class") expands to every
 *   section of that class, so the UI always has a concrete section to mark.
 */
export async function getTeacherScope(staffId: string, schoolId: string): Promise<TeacherScope> {
  const [homeroomSections, assignments] = await Promise.all([
    prisma.section.findMany({
      where: { schoolId, classTeacherId: staffId, status: "active" },
      select: { id: true, name: true, classId: true, class: { select: { name: true } } },
    }),
    prisma.subjectAssignment.findMany({
      where: { schoolId, teacherId: staffId },
      select: {
        subjectId: true,
        subject: { select: { name: true } },
        classId: true,
        class: { select: { name: true } },
        sectionId: true,
        section: { select: { id: true, name: true } },
      },
    }),
  ]);

  const homerooms: HomeroomScope[] = homeroomSections.map((s) => ({
    classId: s.classId,
    className: s.class.name,
    sectionId: s.id,
    sectionName: s.name,
  }));

  const subjectClasses: SubjectScope[] = [];
  for (const a of assignments) {
    if (a.sectionId && a.section) {
      subjectClasses.push({
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        classId: a.classId,
        className: a.class.name,
        sectionId: a.section.id,
        sectionName: a.section.name,
      });
      continue;
    }
    // Whole-class assignment — expand to each of the class's actual sections.
    const sections = await prisma.section.findMany({
      where: { schoolId, classId: a.classId, status: "active" },
      select: { id: true, name: true },
    });
    for (const section of sections) {
      subjectClasses.push({
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        classId: a.classId,
        className: a.class.name,
        sectionId: section.id,
        sectionName: section.name,
      });
    }
  }

  return { homerooms, subjectClasses };
}

export function canMarkHomeroom(scope: TeacherScope, classId: string, sectionId: string): boolean {
  return scope.homerooms.some((h) => h.classId === classId && h.sectionId === sectionId);
}

export function canMarkSubject(scope: TeacherScope, classId: string, sectionId: string, subjectId: string): boolean {
  return scope.subjectClasses.some((s) => s.classId === classId && s.sectionId === sectionId && s.subjectId === subjectId);
}
