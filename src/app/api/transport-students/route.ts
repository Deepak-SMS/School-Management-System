import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { studentTransportInputSchema } from "@/lib/validation/student-transport";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const STUDENT_SELECT = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    admissionNumber: true,
    photoUrl: true,
    class: { select: { id: true, name: true } },
    section: { select: { id: true, name: true } },
  },
};
const ROUTE_SELECT = { select: { id: true, name: true, routeNumber: true } };
const STOP_SELECT = { select: { id: true, name: true } };

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("transportStudents", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const routeId = params.get("routeId") ?? undefined;
    const status = params.get("status") ?? undefined;

    const where: Prisma.StudentTransportWhereInput = {
      schoolId,
      ...(routeId && { routeId }),
      ...(status && { status }),
      ...(q && {
        student: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { admissionNumber: { contains: q } }] },
      }),
    };

    const [data, total] = await Promise.all([
      prisma.studentTransport.findMany({
        where,
        include: { student: STUDENT_SELECT, route: ROUTE_SELECT, pickupStop: STOP_SELECT, dropStop: STOP_SELECT },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.studentTransport.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("transportStudents", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(studentTransportInputSchema.parse(await request.json()));
    const { startDate, endDate, ...rest } = input;

    const [student, route, pickupStop, dropStop, activeEnrollment] = await Promise.all([
      prisma.student.findFirst({ where: { id: rest.studentId, schoolId } }),
      prisma.transportRoute.findFirst({ where: { id: rest.routeId, schoolId } }),
      prisma.transportStop.findFirst({ where: { id: rest.pickupStopId, schoolId } }),
      rest.dropStopId ? prisma.transportStop.findFirst({ where: { id: rest.dropStopId, schoolId } }) : Promise.resolve(null),
      prisma.studentTransport.findFirst({ where: { studentId: rest.studentId, status: "active" } }),
    ]);
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    if (!route) return NextResponse.json({ error: "Route not found." }, { status: 404 });
    if (!pickupStop) return NextResponse.json({ error: "Pickup stop not found." }, { status: 404 });
    if (rest.dropStopId && !dropStop) return NextResponse.json({ error: "Drop stop not found." }, { status: 404 });
    if (activeEnrollment) {
      return NextResponse.json({ error: "This student already has an active transport enrollment — end it before adding a new one." }, { status: 409 });
    }

    const enrollment = await prisma.$transaction(async (tx) => {
      const created = await tx.studentTransport.create({
        data: { schoolId, ...rest, startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : undefined },
        include: { student: STUDENT_SELECT, route: ROUTE_SELECT, pickupStop: STOP_SELECT, dropStop: STOP_SELECT },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "studentTransport.create",
        entityType: "StudentTransport",
        entityId: created.id,
        after: { studentId: rest.studentId, routeId: rest.routeId },
      });
      return created;
    });

    return NextResponse.json(enrollment, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
