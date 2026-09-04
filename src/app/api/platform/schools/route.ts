import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/platform-auth";
import { createSchoolSchema } from "@/lib/validation/platform-school";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { hashPassword, generateTemporaryPassword } from "@/lib/password";
import { generateUniqueSchoolSlug } from "@/lib/slug";
import { recordPlatformAudit } from "@/lib/audit";
import { PLAN_DEFAULT_MODULES } from "@/lib/constants/platform";
import { apiError } from "@/lib/api-error";
import type { SchoolDetail } from "@/types/platform";
import type { Prisma } from "@/generated/prisma/client";

/** The academic year a newly-created school starts on: April-to-March, containing today's date. */
function defaultAcademicYearDates() {
  const now = new Date();
  // April (month index 3) is the conventional Indian academic-year start —
  // before that, "this year" is still the tail of the year that started last April.
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    label: `${startYear}–${String(startYear + 1).slice(-2)}`,
    startDate: new Date(startYear, 3, 1),
    endDate: new Date(startYear + 1, 2, 31),
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;

    const where: Prisma.SchoolWhereInput = {
      ...(status && { status }),
      ...(q && {
        OR: [{ name: { contains: q } }, { shortName: { contains: q } }, { city: { contains: q } }],
      }),
    };

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where,
        include: {
          memberships: {
            where: { role: "school_admin" },
            take: 1,
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          _count: { select: { students: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.school.count({ where }),
    ]);

    const data = schools.map((school) => ({
      id: school.id,
      name: school.name,
      shortName: school.shortName,
      slug: school.slug,
      city: school.city,
      status: school.status,
      plan: school.plan,
      admin: school.memberships[0]?.user ?? null,
      studentCount: school._count.students,
      createdAt: school.createdAt.toISOString(),
    }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = await request.json();
    const input = cleanEmptyStrings(createSchoolSchema.parse(body));

    const temporaryPassword = generateTemporaryPassword();
    const enabledModules = PLAN_DEFAULT_MODULES[input.plan];

    const result = await prisma.$transaction(async (tx) => {
      const slug = await generateUniqueSchoolSlug(input.shortName || input.name, async (candidate) => {
        const existing = await tx.school.findUnique({ where: { slug: candidate }, select: { id: true } });
        return existing !== null;
      });

      const school = await tx.school.create({
        data: {
          name: input.name,
          shortName: input.shortName,
          slug,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country,
          pinCode: input.pinCode,
          phone: input.phone,
          email: input.email,
          status: "trial",
          plan: input.plan,
          enabledModulesJson: enabledModules ? JSON.stringify(enabledModules) : null,
        },
      });

      // Every school starts from the same known-good baseline: one campus,
      // one active academic year, and Classes 1-12 already in place — so the
      // new admin lands on a usable Classes page instead of an empty one and
      // a wall of required setup screens. Both are freely editable afterward.
      const campus = await tx.campus.create({
        data: { schoolId: school.id, name: "Main Campus", code: "MAIN", campusType: "main" },
      });
      const academicYear = await tx.academicYear.create({
        data: { schoolId: school.id, ...defaultAcademicYearDates(), status: "active" },
      });
      await tx.class.createMany({
        data: Array.from({ length: 12 }, (_, i) => {
          const grade = i + 1;
          return {
            schoolId: school.id,
            academicYearId: academicYear.id,
            campusId: campus.id,
            name: `Class ${grade}`,
            code: `CLS${String(grade).padStart(2, "0")}`,
            sortOrder: i,
          };
        }),
      });

      const adminUser = await tx.user.create({
        data: {
          name: input.adminName,
          email: input.adminEmail,
          passwordHash: hashPassword(temporaryPassword),
          mustChangePassword: true,
          isActive: true,
        },
      });

      await tx.schoolMembership.create({
        data: { userId: adminUser.id, schoolId: school.id, role: "school_admin" },
      });

      await recordPlatformAudit(tx, {
        actorUserId: actor.id,
        action: "school.created",
        targetSchoolId: school.id,
        metadata: { plan: input.plan, adminEmail: adminUser.email },
      });

      return { school, adminUser };
    });

    const schoolDetail: SchoolDetail = {
      id: result.school.id,
      name: result.school.name,
      shortName: result.school.shortName,
      slug: result.school.slug,
      city: result.school.city,
      address: result.school.address,
      state: result.school.state,
      country: result.school.country,
      phone: result.school.phone,
      email: result.school.email,
      status: result.school.status,
      plan: result.school.plan,
      admin: { id: result.adminUser.id, name: result.adminUser.name, email: result.adminUser.email },
      studentCount: 0,
      staffCount: 0,
      enabledModules,
      createdAt: result.school.createdAt.toISOString(),
    };

    return NextResponse.json(
      {
        school: schoolDetail,
        admin: { name: result.adminUser.name, email: result.adminUser.email, temporaryPassword },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
