import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { promotionCommitSchema } from "@/lib/validation/promotion";
import { resolveStudentOutcome, suggestTargetClass, suggestSameLevelClass, type PromotableClass } from "@/lib/students/promotion";

/**
 * Step 2 of promotion: resolve every affected student's outcome and write it.
 *
 * The roster is re-fetched here from `classMappings` rather than trusted from
 * the client (same principle as students/import/commit) — the client sends
 * *decisions* (which class maps where, which students are exceptions), never
 * the roster itself. Everything lands in one transaction or nothing does: if
 * any row can't be resolved to a real target class, the whole commit is
 * rejected so the administrator fixes it on the preview screen rather than
 * getting a partially-promoted school.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("students", "promote");
    const { schoolId } = user;
    const input = promotionCommitSchema.parse(await request.json());

    if (input.sourceAcademicYearId === input.targetAcademicYearId) {
      return NextResponse.json({ error: "Source and target academic year must be different." }, { status: 400 });
    }

    const [sourceYear, targetYear] = await Promise.all([
      prisma.academicYear.findFirst({ where: { id: input.sourceAcademicYearId, schoolId }, select: { id: true } }),
      prisma.academicYear.findFirst({ where: { id: input.targetAcademicYearId, schoolId }, select: { id: true } }),
    ]);
    if (!sourceYear) return NextResponse.json({ error: "Source academic year not found." }, { status: 404 });
    if (!targetYear) return NextResponse.json({ error: "Target academic year not found." }, { status: 404 });

    const [sourceClasses, targetClasses] = await Promise.all([
      prisma.class.findMany({
        where: { schoolId, academicYearId: input.sourceAcademicYearId },
        select: { id: true, sortOrder: true, campusId: true },
      }),
      prisma.class.findMany({
        where: { schoolId, academicYearId: input.targetAcademicYearId },
        select: { id: true, sortOrder: true, campusId: true, sections: { select: { id: true } } },
      }),
    ]);
    const sourceClassById = new Map(sourceClasses.map((c) => [c.id, c]));
    const targetClassIds = new Set(targetClasses.map((c) => c.id));
    const targetSectionsByClass = new Map(targetClasses.map((c) => [c.id, new Set(c.sections.map((s) => s.id))]));

    for (const mapping of input.classMappings) {
      if (!sourceClassById.has(mapping.sourceClassId)) {
        return NextResponse.json({ error: "One of the mapped classes no longer belongs to the source academic year." }, { status: 400 });
      }
      if (mapping.targetClassId && !targetClassIds.has(mapping.targetClassId)) {
        return NextResponse.json({ error: "One of the mapped target classes does not belong to the target academic year." }, { status: 400 });
      }
      if (mapping.targetSectionId && !targetSectionsByClass.get(mapping.targetClassId ?? "")?.has(mapping.targetSectionId)) {
        return NextResponse.json({ error: "One of the mapped target sections does not belong to its target class." }, { status: 400 });
      }
    }
    for (const override of input.studentOverrides) {
      if (override.targetClassId && !targetClassIds.has(override.targetClassId)) {
        return NextResponse.json({ error: "One of the student overrides targets a class outside the target academic year." }, { status: 400 });
      }
      if (override.targetSectionId && !targetSectionsByClass.get(override.targetClassId ?? "")?.has(override.targetSectionId)) {
        return NextResponse.json({ error: "One of the student overrides targets a section outside its target class." }, { status: 400 });
      }
    }

    const mappingByClass = new Map(input.classMappings.map((m) => [m.sourceClassId, m]));
    const students = await prisma.student.findMany({
      where: {
        schoolId,
        academicYearId: input.sourceAcademicYearId,
        status: "active",
        classId: { in: input.classMappings.map((m) => m.sourceClassId) },
      },
      select: { id: true, classId: true },
    });

    interface PlannedUpdate {
      studentId: string;
      data: { academicYearId?: string; classId?: string; sectionId?: string | null; promotionStatus: string; status?: string };
    }
    const planned: PlannedUpdate[] = [];
    const unresolved: string[] = [];

    for (const student of students) {
      const mapping = mappingByClass.get(student.classId);
      if (!mapping) continue; // Not one of the classes being promoted this run.
      const outcome = resolveStudentOutcome(student.id, mapping, input.studentOverrides);

      if (outcome.action === "exit") {
        planned.push({ studentId: student.id, data: { promotionStatus: "passed_out", status: "graduated" } });
        continue;
      }

      const sourceClass = sourceClassById.get(student.classId) as PromotableClass;
      let targetClassId = outcome.targetClassId;
      if (!targetClassId) {
        const auto =
          outcome.action === "promote"
            ? suggestTargetClass(sourceClass, targetClasses)
            : suggestSameLevelClass(sourceClass, targetClasses);
        targetClassId = auto?.id;
      }
      if (!targetClassId) {
        unresolved.push(student.id);
        continue;
      }

      planned.push({
        studentId: student.id,
        data: {
          academicYearId: input.targetAcademicYearId,
          classId: targetClassId,
          sectionId: outcome.targetSectionId ?? null,
          promotionStatus: outcome.action === "promote" ? "promoted" : "retained",
        },
      });
    }

    if (unresolved.length > 0) {
      return NextResponse.json(
        {
          error: `${unresolved.length} student${unresolved.length === 1 ? " has" : "s have"} no matching class in the target academic year. Pick a target class for those rows, or mark them Retain/Graduate, then try again.`,
        },
        { status: 422 },
      );
    }

    const counts = { promoted: 0, retained: 0, exited: 0 };
    for (const item of planned) {
      if (item.data.promotionStatus === "promoted") counts.promoted += 1;
      else if (item.data.promotionStatus === "retained") counts.retained += 1;
      else counts.exited += 1;
    }

    await prisma.$transaction(async (tx) => {
      for (const item of planned) {
        await tx.student.update({ where: { id: item.studentId }, data: item.data });
      }
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "student.promotion.commit",
        entityType: "AcademicYear",
        entityId: input.targetAcademicYearId,
        after: { sourceAcademicYearId: input.sourceAcademicYearId, targetAcademicYearId: input.targetAcademicYearId, ...counts },
      });
    });

    return NextResponse.json({ ...counts, total: planned.length });
  } catch (error) {
    return apiError(error);
  }
}
