import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { DATASETS, visibleColumns, shapeStudentRow } from "@/lib/database/datasets";
import { buildWorkbook } from "@/lib/database/workbook";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Class/section-scoped student export for the Student Accounts page — same
 * columns and workbook format as the whole-database export (GET
 * /api/database/export), but rows are narrowed to whatever Class/Section/search
 * is currently selected there, and always sorted class-then-section so an
 * unfiltered download still reads as one class/section block at a time.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("database", "export");
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const classId = params.get("classId") ?? undefined;
    const sectionId = params.get("sectionId") ?? undefined;

    const where: Prisma.StudentWhereInput = {
      schoolId: user.schoolId,
      status: "active",
      ...(classId && { classId }),
      ...(sectionId && { sectionId }),
      ...(q && {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { admissionNumber: { contains: q } },
        ],
      }),
    };

    const [rows, classLabel, sectionLabel] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { class: true, section: true, academicYear: true },
        orderBy: [{ class: { sortOrder: "asc" } }, { section: { name: "asc" } }, { admissionNumber: "asc" }],
      }),
      classId ? prisma.class.findUnique({ where: { id: classId }, select: { name: true } }) : null,
      sectionId ? prisma.section.findUnique({ where: { id: sectionId }, select: { name: true } }) : null,
    ]);

    const studentsDataset = DATASETS.find((d) => d.key === "students")!;
    const scopeLabel = [classLabel?.name, sectionLabel ? `Section ${sectionLabel.name}` : null].filter(Boolean).join(" · ");

    const buffer = await buildWorkbook(
      [{ dataset: studentsDataset, columns: visibleColumns(studentsDataset, user), rows: rows.map(shapeStudentRow) }],
      {
        title: scopeLabel ? `Students — ${scopeLabel}` : "Students — all classes",
        notes: [
          `Exported ${new Date().toISOString().slice(0, 16).replace("T", " ")} by ${user.name}.`,
          scopeLabel ? `Filtered to ${scopeLabel}.` : "All classes and sections, grouped by class then section.",
        ],
        includeCounts: true,
      },
    );

    const stamp = new Date().toISOString().slice(0, 10);
    const scopeSuffix = [classLabel?.name, sectionLabel?.name].filter((v): v is string => Boolean(v)).map(slug).join("-");
    const filename = `students${scopeSuffix ? `-${scopeSuffix}` : ""}-${stamp}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
