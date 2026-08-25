import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const bulkAssignmentInputSchema = z.object({
  academicYearId: z.string().min(1, "Academic year is required"),
  classId: z.string().min(1, "Class is required"),
  /** "all" assigns the whole class as one wildcard row (sectionId = null); "sections" assigns each listed section individually. */
  scope: z.enum(["all", "sections"]),
  sectionIds: z.array(z.string()).optional(),
  teacherId: z.string().trim().optional(),
});

/**
 * Assigns a subject to a class in one action — either the whole class at
 * once ("all sections") or a chosen subset of its sections. Skips
 * combinations already assigned instead of failing the whole batch, so a
 * partial re-run (e.g. after adding a new section) just fills the gap.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("subjects", "edit");
    const { id: subjectId } = await params;
    const input = cleanEmptyStrings(bulkAssignmentInputSchema.parse(await request.json()));

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
    if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });

    const cls = await prisma.class.findFirst({ where: { id: input.classId, schoolId } });
    if (!cls) {
      return NextResponse.json({ error: "Validation failed", fieldErrors: { classId: ["Class not found."] } }, { status: 422 });
    }

    let sectionIds: (string | null)[];
    if (input.scope === "all") {
      sectionIds = [null];
    } else {
      const requested = input.sectionIds ?? [];
      if (requested.length === 0) {
        return NextResponse.json(
          { error: "Validation failed", fieldErrors: { sectionIds: ["Choose at least one section."] } },
          { status: 422 },
        );
      }
      const validSections = await prisma.section.findMany({ where: { id: { in: requested }, classId: input.classId } });
      sectionIds = validSections.map((s) => s.id);
    }

    const created: unknown[] = [];
    let skipped = 0;

    await prisma.$transaction(async (tx) => {
      for (const sectionId of sectionIds) {
        const existing = await tx.subjectAssignment.findFirst({
          where: { subjectId, academicYearId: input.academicYearId, classId: input.classId, sectionId },
        });
        if (existing) {
          skipped++;
          continue;
        }
        const assignment = await tx.subjectAssignment.create({
          data: { schoolId, subjectId, academicYearId: input.academicYearId, classId: input.classId, sectionId, teacherId: input.teacherId },
          include: {
            academicYear: { select: { id: true, label: true } },
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
            teacher: { select: { id: true, fullName: true } },
          },
        });
        created.push(assignment);
        await recordAudit(tx, {
          schoolId,
          action: "subjectAssignment.create",
          entityType: "SubjectAssignment",
          entityId: assignment.id,
          after: assignment,
        });
      }
    });

    return NextResponse.json({ created, createdCount: created.length, skippedCount: skipped }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
