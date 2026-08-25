import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

/**
 * Subjects from the class's point of view.
 *
 * The subject-centric routes under /api/subjects/[id]/assignments already handle
 * "which classes take this subject". This is the mirror image — "which subjects
 * does this class take" — which is how a school actually thinks about a
 * timetable. Both read and write the same SubjectAssignment rows; there is no
 * second source of truth.
 */

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("subjects", "view");
    const { id } = await params;
    const academicYearId = request.nextUrl.searchParams.get("academicYearId") ?? undefined;

    const cls = await prisma.class.findFirst({
      where: { id, schoolId },
      select: { id: true, name: true, sections: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const assignments = await prisma.subjectAssignment.findMany({
      where: { classId: id, schoolId, ...(academicYearId && { academicYearId }) },
      include: {
        subject: { select: { id: true, name: true, code: true, subjectType: true, natureType: true, status: true } },
        section: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true } },
        academicYear: { select: { id: true, label: true } },
      },
      orderBy: [{ subject: { name: "asc" } }],
    });

    return NextResponse.json({
      class: { id: cls.id, name: cls.name, sections: cls.sections },
      data: assignments,
      total: assignments.length,
    });
  } catch (error) {
    return apiError(error);
  }
}

const assignSchema = z
  .object({
    academicYearId: z.string().trim().min(1, "Academic year is required"),
    /** Assign a subject that already exists... */
    subjectId: z.string().trim().optional(),
    /** ...or create one inline, so adding a subject to a class is a single step. */
    name: z.string().trim().max(120).optional(),
    code: z.string().trim().max(30).optional(),
    subjectType: z.enum(["core", "elective", "optional", "co_curricular", "practical", "language"]).optional(),
    /** Omitted or empty means "every section of this class", stored as sectionId = null. */
    sectionIds: z.array(z.string().trim().min(1)).max(50).optional(),
    teacherId: z.string().trim().optional(),
  })
  .refine((v) => Boolean(v.subjectId) || Boolean(v.name), {
    message: "Choose an existing subject or enter a name for a new one",
    path: ["subjectId"],
  });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("subjects", "create");
    const { schoolId } = user;
    const { id } = await params;

    const cls = await prisma.class.findFirst({ where: { id, schoolId }, select: { id: true, name: true } });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const input = cleanEmptyStrings(assignSchema.parse(await request.json()));

    const academicYear = await prisma.academicYear.findFirst({
      where: { id: input.academicYearId, schoolId },
      select: { id: true },
    });
    if (!academicYear) return NextResponse.json({ error: "Academic year not found." }, { status: 404 });

    // Sections must belong to this class — otherwise a guessed id could attach a
    // subject to another class's section.
    if (input.sectionIds?.length) {
      const valid = await prisma.section.count({
        where: { schoolId, classId: id, id: { in: input.sectionIds } },
      });
      if (valid !== input.sectionIds.length) {
        return NextResponse.json({ error: "One or more sections don't belong to this class." }, { status: 422 });
      }
    }

    if (input.teacherId) {
      const teacher = await prisma.staff.findFirst({ where: { id: input.teacherId, schoolId }, select: { id: true } });
      if (!teacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let subjectId = input.subjectId;

      if (!subjectId) {
        const name = input.name!.trim();
        const code = (input.code?.trim() || name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20)) || "SUBJECT";

        // Reuse a subject with the same code rather than creating a duplicate —
        // "Mathematics" should be one subject shared across classes.
        const existing = await tx.subject.findFirst({ where: { schoolId, code } });
        if (existing) {
          subjectId = existing.id;
        } else {
          const created = await tx.subject.create({
            data: { schoolId, name, code, subjectType: input.subjectType ?? "core", status: "active" },
          });
          subjectId = created.id;
          await recordAudit(tx, {
            schoolId,
            userId: user.id,
            action: "subject.create",
            entityType: "Subject",
            entityId: created.id,
            after: { name: created.name, code: created.code },
          });
        }
      } else {
        const subject = await tx.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true } });
        if (!subject) throw new SubjectNotFoundError();
      }

      // `sectionId: null` is the whole-class assignment; specific sections each
      // get their own row.
      const targets: (string | null)[] = input.sectionIds?.length ? input.sectionIds : [null];

      let created = 0;
      let skipped = 0;
      for (const sectionId of targets) {
        const duplicate = await tx.subjectAssignment.findFirst({
          where: { subjectId, academicYearId: academicYear.id, classId: id, sectionId },
        });
        if (duplicate) {
          skipped++;
          continue;
        }
        await tx.subjectAssignment.create({
          data: {
            schoolId,
            subjectId,
            academicYearId: academicYear.id,
            classId: id,
            sectionId,
            teacherId: input.teacherId,
          },
        });
        created++;
      }

      if (created > 0) {
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "subject.assign",
          entityType: "Class",
          entityId: id,
          after: { subjectId, className: cls.name, created, skipped },
        });
      }

      return { subjectId, created, skipped };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof SubjectNotFoundError) {
      return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    }
    return apiError(error);
  }
}

/** Thrown inside the transaction so the 404 isn't swallowed as a generic 500. */
class SubjectNotFoundError extends Error {
  constructor() {
    super("Subject not found.");
    this.name = "SubjectNotFoundError";
  }
}
