import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { resolvePortalStudent } from "@/lib/portal-scope";
import { apiError } from "@/lib/api-error";

const ROUTE_SELECT = { select: { id: true, name: true, routeNumber: true, morningTiming: true, afternoonTiming: true } };
const STOP_SELECT = { select: { id: true, name: true, landmark: true } };
const DRIVER_SELECT = { select: { id: true, fullName: true, phone: true } };
const VEHICLE_SELECT = { select: { id: true, vehicleNumber: true, vehicleType: true } };

/**
 * A student/parent's own transport assignment — route, stops, and the route's
 * *current* vehicle/driver. Composed from the same two lookups the admin side
 * uses (src/app/api/transport-students/[id]/route.ts for the enrollment, and
 * src/app/api/transport-routes/[id]/assignment/route.ts's "no effectiveTo"
 * convention for who's currently driving it), just keyed by studentId instead
 * of enrollment/route id.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("transportStudents", "view");
    const { studentId } = await resolvePortalStudent(request.nextUrl.searchParams.get("studentId"));

    const enrollment = await prisma.studentTransport.findFirst({
      where: { studentId, status: "active" },
      include: { route: ROUTE_SELECT, pickupStop: STOP_SELECT, dropStop: STOP_SELECT },
    });
    if (!enrollment) return NextResponse.json({ data: null });

    const assignment = await prisma.transportRouteAssignment.findFirst({
      where: { routeId: enrollment.routeId, effectiveTo: null },
      include: { vehicle: VEHICLE_SELECT, driver: DRIVER_SELECT },
    });

    return NextResponse.json({
      data: {
        route: enrollment.route,
        pickupStop: enrollment.pickupStop,
        dropStop: enrollment.dropStop,
        direction: enrollment.direction,
        vehicle: assignment?.vehicle ?? null,
        driver: assignment?.driver ?? null,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
