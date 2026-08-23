import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";

export async function GET() {
  const schoolId = await getCurrentSchoolId();

  const [totalStudents, totalStaff, totalTeachers, cardsByStatus] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "active" } }),
    prisma.staff.count({ where: { schoolId, category: { not: "teacher" } } }),
    prisma.staff.count({ where: { schoolId, category: "teacher" } }),
    prisma.iDCard.groupBy({ by: ["status"], where: { schoolId }, _count: true }),
  ]);

  const statusCounts = Object.fromEntries(cardsByStatus.map((row) => [row.status, row._count]));
  const cardsGenerated = cardsByStatus.reduce((sum, row) => sum + row._count, 0);
  const totalPeople = totalStudents + totalStaff + totalTeachers;

  return NextResponse.json({
    totalStudents,
    totalStaff,
    totalTeachers,
    cardsGenerated,
    cardsPending: Math.max(totalPeople - cardsGenerated, 0),
    lostCards: statusCounts.lost ?? 0,
    blockedCards: statusCounts.blocked ?? 0,
    replacedCards: statusCounts.replaced ?? 0,
    activeCards: statusCounts.active ?? 0,
  });
}
