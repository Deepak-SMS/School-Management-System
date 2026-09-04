import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionUserId } from "@/lib/session";
import { apiError } from "@/lib/api-error";

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]!.toUpperCase()).join("") || "?";
}

/** Real schools (+ campuses, academic years) the signed-in user belongs to — feeds the top-nav school switcher. */
export async function GET() {
  try {
    const userId = await requireSessionUserId();

    const memberships = await prisma.schoolMembership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        school: {
          select: {
            id: true,
            name: true,
            shortName: true,
            campuses: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, city: true, campusType: true } },
            academicYears: {
              orderBy: { startDate: "desc" },
              select: { id: true, label: true, startDate: true, endDate: true, status: true },
            },
          },
        },
      },
    });

    const schools = memberships.map(({ school }) => ({
      id: school.id,
      name: school.name,
      shortName: school.shortName,
      logoInitials: initialsOf(school.shortName || school.name),
      campuses: school.campuses.map((campus) => ({
        id: campus.id,
        name: campus.name,
        city: campus.city ?? "",
        isPrimary: campus.campusType === "main",
      })),
      academicYears: school.academicYears.map((year) => ({
        id: year.id,
        label: year.label,
        startDate: year.startDate.toISOString(),
        endDate: year.endDate.toISOString(),
        isCurrent: year.status === "active",
      })),
    }));

    return NextResponse.json(schools);
  } catch (error) {
    return apiError(error);
  }
}
