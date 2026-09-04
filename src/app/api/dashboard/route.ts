import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/config/permissions";
import { apiError } from "@/lib/api-error";
import { summarizeStudentFees } from "@/lib/student-fee-ledger";
import { ACTIVE_EMPLOYMENT_STATUSES } from "@/lib/constants/hr";
import { getAttendanceOverview } from "@/lib/attendance-dashboard";

/**
 * Aggregates for the main "/" dashboard — every school-side role lands here
 * (see config/navigation.ts), so unlike a module dashboard (e.g. /api/hr/dashboard)
 * there is no single permission gate: each section independently checks the
 * viewer's permission on its underlying module and is simply omitted if absent,
 * same as HR dashboard's optional `recruitment` block. Every figure is a real
 * query against real rows — a module with no backend yet (exams, timetable, AI
 * insights, live GPS, SMS/WhatsApp send-log) is never faked with sample numbers;
 * the client renders an explicit "not available yet" card for those instead.
 */

const DOCUMENT_EXPIRY_WINDOW_DAYS = 30;
const HOLIDAY_WINDOW_DAYS = 30;
const NEW_ADMISSION_WINDOW_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 15;

export async function GET() {
  try {
    const user = await getCurrentUser();
    const { schoolId, role } = user;
    const can = (module: Parameters<typeof hasPermission>[1], action: Parameters<typeof hasPermission>[2]) =>
      hasPermission(role, module, action);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const admissionCutoff = new Date(now.getTime() - NEW_ADMISSION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const holidayCutoff = new Date(todayStart.getTime() + HOLIDAY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const perms = {
      students: can("students", "view"),
      staff: can("employees", "view"),
      attendance: can("studentAttendance", "view"),
      fees: can("studentFees", "view"),
      admissions: can("admissionEnquiries", "view"),
      transport: can("transportVehicles", "view"),
      library: can("libraryCatalogue", "view"),
      certificates: can("certificates", "view"),
      holidays: can("holidays", "view"),
      staffDocs: can("employeeDocuments", "view"),
      registrationApprove: can("studentRegistrations", "approve"),
      leaveApprove: can("staffLeave", "approve"),
      expenseApprove: can("expenses", "approve"),
    };
    const canSeeActivity = perms.students || perms.staff;

    const [school, activeYear, latestYear] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
      prisma.academicYear.findFirst({ where: { schoolId, status: "active" }, select: { label: true } }),
      prisma.academicYear.findFirst({ where: { schoolId }, orderBy: { startDate: "desc" }, select: { label: true } }),
    ]);

    // ---- Students -----------------------------------------------------
    const studentsPromise = perms.students
      ? (async () => {
          const [total, active, byGender, newAdmissions] = await Promise.all([
            prisma.student.count({ where: { schoolId } }),
            prisma.student.count({ where: { schoolId, status: "active" } }),
            prisma.student.groupBy({
              by: ["gender"],
              where: { schoolId, status: "active" },
              _count: { _all: true },
            }),
            prisma.student.count({ where: { schoolId, admissionDate: { gte: admissionCutoff } } }),
          ]);
          const genderCount = (g: string) => byGender.find((r) => r.gender === g)?._count._all ?? 0;
          return {
            total,
            active,
            boys: genderCount("male"),
            girls: genderCount("female"),
            newAdmissions,
          };
        })()
      : Promise.resolve(null);

    // ---- Staff ----------------------------------------------------------
    const employed = { in: [...ACTIVE_EMPLOYMENT_STATUSES] };
    const staffPromise = perms.staff
      ? (async () => {
          const [total, teaching, active, onLeave] = await Promise.all([
            prisma.staff.count({ where: { schoolId } }),
            prisma.staff.count({ where: { schoolId, category: "teacher", employmentStatus: employed } }),
            prisma.staff.count({ where: { schoolId, employmentStatus: "active" } }),
            prisma.staff.count({ where: { schoolId, employmentStatus: "on_leave" } }),
          ]);
          return { total, teaching, nonTeaching: total - teaching, active, onLeave };
        })()
      : Promise.resolve(null);

    // ---- Attendance (today + weekly trend + class-wise) -----------------
    const attendancePromise = perms.attendance ? getAttendanceOverview(schoolId) : Promise.resolve(null);

    // ---- Fees -------------------------------------------------------------
    const feesPromise = perms.fees
      ? (async () => {
          const [students, todayAgg, monthAgg] = await Promise.all([
            prisma.student.findMany({
              where: { schoolId, feeCharges: { some: {} } },
              select: {
                id: true,
                feeCharges: {
                  select: {
                    amount: true,
                    dueDate: true,
                    status: true,
                    adjustments: { select: { type: true, amount: true } },
                    allocations: { select: { amount: true, payment: { select: { status: true } } } },
                  },
                },
              },
            }),
            prisma.payment.aggregate({
              where: { schoolId, status: { not: "cancelled" }, paidOn: { gte: todayStart, lt: todayEnd } },
              _sum: { amount: true },
            }),
            prisma.payment.aggregate({
              where: { schoolId, status: { not: "cancelled" }, paidOn: { gte: monthStart, lt: todayEnd } },
              _sum: { amount: true },
            }),
          ]);

          const summaries = students.map((s) => summarizeStudentFees(s.feeCharges));
          const totals = summaries.reduce(
            (acc, s) => ({
              charged: acc.charged + s.totalCharged,
              paid: acc.paid + s.totalPaid,
              pending: acc.pending + s.totalPending,
              overdue: acc.overdue + s.totalOverdue,
            }),
            { charged: 0, paid: 0, pending: 0, overdue: 0 },
          );
          const defaulterCount = summaries.filter((s) => s.totalOverdue > 0).length;

          return {
            ...totals,
            collectedToday: todayAgg._sum.amount ?? 0,
            collectedThisMonth: monthAgg._sum.amount ?? 0,
            defaulterCount,
          };
        })()
      : Promise.resolve(null);

    // ---- Admissions ---------------------------------------------------
    const admissionsPromise = perms.admissions
      ? (async () => {
          const [enquiryByStatus, registrationByStatus, enrolled] = await Promise.all([
            prisma.admissionEnquiry.groupBy({ by: ["status"], where: { schoolId }, _count: { _all: true } }),
            prisma.studentRegistration.groupBy({ by: ["status"], where: { schoolId }, _count: { _all: true } }),
            prisma.studentRegistration.count({ where: { schoolId, studentId: { not: null } } }),
          ]);
          const enquiryCount = (s: string) => enquiryByStatus.find((r) => r.status === s)?._count._all ?? 0;
          const registrationCount = (s: string) => registrationByStatus.find((r) => r.status === s)?._count._all ?? 0;
          const enquiriesTotal = enquiryByStatus.reduce((sum, r) => sum + r._count._all, 0);
          const registrationsTotal = registrationByStatus.reduce((sum, r) => sum + r._count._all, 0);

          return {
            enquiries: {
              total: enquiriesTotal,
              new: enquiryCount("new"),
              contacted: enquiryCount("contacted"),
              interested: enquiryCount("interested"),
              converted: enquiryCount("converted"),
            },
            registrations: {
              total: registrationsTotal,
              pending: registrationCount("pending"),
              approved: registrationCount("approved"),
              rejected: registrationCount("rejected"),
            },
            funnel: [
              { label: "Enquiries", count: enquiriesTotal },
              { label: "Applications", count: registrationsTotal },
              { label: "Approved", count: registrationCount("approved") },
              { label: "Enrolled", count: enrolled },
            ],
          };
        })()
      : Promise.resolve(null);

    // ---- Transport ------------------------------------------------------
    const transportPromise = perms.transport
      ? (async () => {
          const [byStatus, routesActive, studentsEnrolled] = await Promise.all([
            prisma.transportVehicle.groupBy({ by: ["status"], where: { schoolId }, _count: { _all: true } }),
            prisma.transportRoute.count({ where: { schoolId, status: "active" } }),
            prisma.studentTransport.count({ where: { schoolId, status: "active" } }),
          ]);
          const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
          const total = byStatus.reduce((sum, r) => sum + r._count._all, 0);
          return {
            total,
            active: count("active"),
            maintenance: count("maintenance"),
            inactive: count("inactive"),
            routesActive,
            studentsEnrolled,
          };
        })()
      : Promise.resolve(null);

    // ---- Library ----------------------------------------------------------
    const libraryPromise = perms.library
      ? (async () => {
          const [totalTitles, totalCategories, copiesByStatus] = await Promise.all([
            prisma.libraryBook.count({ where: { schoolId, isActive: true } }),
            prisma.libraryCategory.count({ where: { schoolId } }),
            prisma.libraryBookCopy.groupBy({ by: ["status"], where: { schoolId }, _count: true }),
          ]);
          const statusCounts = Object.fromEntries(copiesByStatus.map((row) => [row.status, row._count]));
          const totalBooks = copiesByStatus.reduce((sum, row) => sum + row._count, 0);
          return {
            totalTitles,
            totalCategories,
            totalBooks,
            available: statusCounts.available ?? 0,
            issued: statusCounts.issued ?? 0,
          };
        })()
      : Promise.resolve(null);

    // ---- Certificates -------------------------------------------------
    const certificatesPromise = perms.certificates
      ? (async () => {
          const [generatedThisMonth, totalActive] = await Promise.all([
            prisma.certificate.count({ where: { schoolId, issueDate: { gte: monthStart }, revokedAt: null } }),
            prisma.certificate.count({ where: { schoolId, revokedAt: null } }),
          ]);
          return { generatedThisMonth, totalActive };
        })()
      : Promise.resolve(null);

    // ---- News (open to any signed-in school member, same as /api/news) ---
    const newsPromise = (async () => {
      const byStatus = await prisma.news.groupBy({ by: ["status"], where: { schoolId }, _count: { _all: true } });
      const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
      return { published: count("published"), draft: count("draft") };
    })();

    // ---- Holidays (upcoming) -------------------------------------------
    const holidaysPromise = perms.holidays
      ? prisma.holiday.findMany({
          where: { schoolId, startDate: { gte: todayStart, lte: holidayCutoff } },
          orderBy: { startDate: "asc" },
          take: 8,
          select: { id: true, name: true, startDate: true, endDate: true },
        })
      : Promise.resolve(null);

    // ---- Alerts / needs attention ---------------------------------------
    const expiryCutoff = new Date(now.getTime() + DOCUMENT_EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const alertsPromise = (async () => {
      const alerts: { id: string; severity: "info" | "warning" | "danger"; message: string; href: string }[] = [];

      const checks: Promise<void>[] = [];
      if (perms.registrationApprove) {
        checks.push(
          prisma.studentRegistration.count({ where: { schoolId, status: "pending" } }).then((n) => {
            if (n > 0)
              alerts.push({
                id: "registrations-pending",
                severity: "warning",
                message: `${n} admission application${n === 1 ? "" : "s"} awaiting review.`,
                href: "/admissions/applications",
              });
          }),
        );
      }
      if (perms.admissions) {
        checks.push(
          prisma.admissionEnquiry
            .count({
              where: { schoolId, followUpDate: { lt: todayStart }, status: { notIn: ["converted", "not_interested"] } },
            })
            .then((n) => {
              if (n > 0)
                alerts.push({
                  id: "enquiries-followup",
                  severity: "info",
                  message: `${n} admission enquir${n === 1 ? "y needs" : "ies need"} follow-up.`,
                  href: "/admissions/enquiries",
                });
            }),
        );
      }
      if (perms.leaveApprove) {
        checks.push(
          prisma.leaveRequest.count({ where: { schoolId, status: "pending" } }).then((n) => {
            if (n > 0)
              alerts.push({
                id: "leave-pending",
                severity: "warning",
                message: `${n} leave request${n === 1 ? "" : "s"} awaiting approval.`,
                href: "/hr/leave",
              });
          }),
        );
      }
      if (perms.expenseApprove) {
        checks.push(
          prisma.expense.count({ where: { schoolId, status: "submitted" } }).then((n) => {
            if (n > 0)
              alerts.push({
                id: "expenses-pending",
                severity: "warning",
                message: `${n} expense claim${n === 1 ? "" : "s"} awaiting approval.`,
                href: "/finance/expenses",
              });
          }),
        );
      }
      if (perms.staffDocs) {
        checks.push(
          prisma.staffDocument.count({ where: { schoolId, expiryDate: { gte: now, lte: expiryCutoff } } }).then((n) => {
            if (n > 0)
              alerts.push({
                id: "documents-expiring",
                severity: "warning",
                message: `${n} employee document${n === 1 ? " expires" : "s expire"} within ${DOCUMENT_EXPIRY_WINDOW_DAYS} days.`,
                href: "/employees",
              });
          }),
        );
      }
      await Promise.all(checks);
      // Fee defaulters read from the fees section already computed above, added after.
      return alerts;
    })();

    // ---- Recent activity --------------------------------------------------
    const activityPromise = canSeeActivity
      ? (async () => {
          const rows = await prisma.auditLog.findMany({
            where: { schoolId },
            orderBy: { createdAt: "desc" },
            take: RECENT_ACTIVITY_LIMIT,
            select: { id: true, action: true, entityType: true, createdAt: true, userId: true },
          });
          const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id))];
          const users = userIds.length
            ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
            : [];
          const nameOf = (id: string | null) => (id && users.find((u) => u.id === id)?.name) || "System";

          return rows.map((r) => ({
            id: r.id,
            when: r.createdAt.toISOString(),
            actor: nameOf(r.userId),
            action: humanizeAction(r.action),
            entityType: r.entityType,
          }));
        })()
      : Promise.resolve(null);

    const [
      students,
      staff,
      attendance,
      fees,
      admissions,
      transport,
      library,
      certificates,
      news,
      holidays,
      alerts,
      recentActivity,
    ] = await Promise.all([
      studentsPromise,
      staffPromise,
      attendancePromise,
      feesPromise,
      admissionsPromise,
      transportPromise,
      libraryPromise,
      certificatesPromise,
      newsPromise,
      holidaysPromise,
      alertsPromise,
      activityPromise,
    ]);

    if (fees && fees.defaulterCount > 0) {
      alerts.unshift({
        id: "fees-overdue",
        severity: "danger",
        message: `${fees.defaulterCount} student${fees.defaulterCount === 1 ? "" : "s"} have overdue fees (₹${Math.round(fees.overdue).toLocaleString("en-IN")}).`,
        href: "/fees/student-fees",
      });
    }

    return NextResponse.json({
      school: { name: school?.name ?? "" },
      academicYearLabel: activeYear?.label ?? latestYear?.label ?? null,
      greetingName: user.name.split(" ")[0],
      students,
      staff,
      attendance,
      fees,
      admissions,
      transport,
      library,
      certificates,
      news,
      holidays,
      alerts,
      recentActivity,
      unavailable: ["exams", "timetable", "aiInsights", "communications", "liveGps"],
    });
  } catch (error) {
    return apiError(error);
  }
}

/** Turns a stored action string ("payment.created", "student_registration.approved") into readable text. */
function humanizeAction(action: string): string {
  const words = action.replace(/[._]/g, " ").trim().split(/\s+/);
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
