import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";

/**
 * The people an ID card can be issued to, with whether they already have one.
 *
 * This is what the dashboard's KPI cards drill into: "24 students" and
 * "38 pending" both resolve to a list of actual people, so a number on the
 * dashboard is always something you can click through and act on.
 *
 * `type`: all | student | teacher | staff
 * `cardStatus`: all | pending | generated
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("idCards", "view");
    const params = request.nextUrl.searchParams;

    const type = params.get("type") ?? "all";
    const cardStatus = params.get("cardStatus") ?? "all";
    const q = params.get("q")?.trim();
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 25)));

    const wantsStudents = type === "all" || type === "student";
    const wantsStaff = type === "all" || type === "teacher" || type === "staff";

    // Only active students are card-eligible; a card for someone who has left
    // would be issued and immediately invalid.
    const [students, staff] = await Promise.all([
      wantsStudents
        ? prisma.student.findMany({
            where: {
              schoolId,
              status: "active",
              ...(q && {
                OR: [
                  { firstName: { contains: q } },
                  { lastName: { contains: q } },
                  { admissionNumber: { contains: q } },
                ],
              }),
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              photoUrl: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
              idCards: { select: { id: true, status: true, cardNumber: true }, orderBy: { createdAt: "desc" }, take: 1 },
            },
            orderBy: { firstName: "asc" },
          })
        : [],
      wantsStaff
        ? prisma.staff.findMany({
            where: {
              schoolId,
              ...(type === "teacher" && { category: "teacher" }),
              ...(type === "staff" && { category: { not: "teacher" } }),
              ...(q && {
                OR: [{ fullName: { contains: q } }, { employeeId: { contains: q } }],
              }),
            },
            select: {
              id: true,
              fullName: true,
              employeeId: true,
              photoUrl: true,
              category: true,
              designation: { select: { name: true } },
              department: { select: { name: true } },
              idCards: { select: { id: true, status: true, cardNumber: true }, orderBy: { createdAt: "desc" }, take: 1 },
            },
            orderBy: { fullName: "asc" },
          })
        : [],
    ]);

    // Both kinds are flattened to one shape so the list renders uniformly and
    // "all" can mix students and staff in a single table.
    const people = [
      ...students.map((s) => ({
        id: s.id,
        personType: "student" as const,
        name: [s.firstName, s.lastName].filter(Boolean).join(" "),
        reference: s.admissionNumber,
        detail: [s.class?.name, s.section?.name].filter(Boolean).join(" · "),
        photoUrl: s.photoUrl,
        card: s.idCards[0] ?? null,
      })),
      ...staff.map((s) => ({
        id: s.id,
        personType: (s.category === "teacher" ? "teacher" : "staff") as "teacher" | "staff",
        name: s.fullName,
        reference: s.employeeId,
        detail: [s.designation?.name, s.department?.name].filter(Boolean).join(" · "),
        photoUrl: s.photoUrl,
        card: s.idCards[0] ?? null,
      })),
    ];

    const filtered =
      cardStatus === "pending"
        ? people.filter((p) => !p.card)
        : cardStatus === "generated"
          ? people.filter((p) => Boolean(p.card))
          : people;

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    const total = filtered.length;
    const start = (page - 1) * pageSize;

    return NextResponse.json({
      data: filtered.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      counts: {
        students: people.filter((p) => p.personType === "student").length,
        teachers: people.filter((p) => p.personType === "teacher").length,
        staff: people.filter((p) => p.personType === "staff").length,
        pending: people.filter((p) => !p.card).length,
        generated: people.filter((p) => Boolean(p.card)).length,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
