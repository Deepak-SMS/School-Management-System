import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, currentUserCan } from "@/lib/authorize";
import { ACTIVE_EMPLOYMENT_STATUSES } from "@/lib/constants/hr";
import { apiError } from "@/lib/api-error";

/**
 * Aggregates for the HR dashboard. Every figure is a real query against real
 * rows — where a module doesn't exist yet (attendance, leave), the field is
 * omitted entirely rather than filled with a placeholder number, and the UI
 * shows an explicit "not available yet" card for it.
 */

const DOCUMENT_EXPIRY_WINDOW_DAYS = 30;
const UPCOMING_WINDOW_DAYS = 30;
const NEW_JOINER_WINDOW_DAYS = 30;

/**
 * Birthdays and anniversaries need day-of-year matching, which SQLite can't
 * express through Prisma's date filters. The staff table is per-school and small
 * enough (thousands at most) that pulling the two date columns and matching in
 * memory is cheaper than the alternatives, and stays correct across year
 * boundaries.
 */
function withinUpcomingWindow(date: Date | null, days: number): boolean {
  if (!date) return false;
  const today = new Date();
  const target = new Date(today.getFullYear(), date.getMonth(), date.getDate());
  // If the anniversary already passed this year, look at next year's.
  if (target < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    target.setFullYear(today.getFullYear() + 1);
  }
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= days;
}

export async function GET() {
  try {
    const user = await requirePermission("hrDashboard", "view");
    const { schoolId } = user;

    const now = new Date();
    const expiryCutoff = new Date(now.getTime() + DOCUMENT_EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const newJoinerCutoff = new Date(now.getTime() - NEW_JOINER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const employed = { in: [...ACTIVE_EMPLOYMENT_STATUSES] };

    const [
      totalEmployees,
      teachingStaff,
      activeEmployees,
      onProbation,
      onLeave,
      noticePeriod,
      newJoiners,
      expiringDocuments,
      pendingDocuments,
      byDepartment,
      byEmployeeType,
      byGender,
      byCampus,
      dateRows,
    ] = await Promise.all([
      prisma.staff.count({ where: { schoolId } }),
      prisma.staff.count({ where: { schoolId, category: "teacher", employmentStatus: employed } }),
      prisma.staff.count({ where: { schoolId, employmentStatus: "active" } }),
      prisma.staff.count({ where: { schoolId, employmentStatus: "probation" } }),
      prisma.staff.count({ where: { schoolId, employmentStatus: "on_leave" } }),
      prisma.staff.count({ where: { schoolId, employmentStatus: "notice_period" } }),
      prisma.staff.count({ where: { schoolId, joiningDate: { gte: newJoinerCutoff } } }),
      prisma.staffDocument.count({
        where: { schoolId, expiryDate: { gte: now, lte: expiryCutoff } },
      }),
      prisma.staffDocument.count({ where: { schoolId, status: "pending" } }),
      prisma.staff.groupBy({
        by: ["departmentId"],
        where: { schoolId, employmentStatus: employed },
        _count: { _all: true },
      }),
      prisma.staff.groupBy({
        by: ["employeeTypeId"],
        where: { schoolId, employmentStatus: employed },
        _count: { _all: true },
      }),
      prisma.staff.groupBy({
        by: ["gender"],
        where: { schoolId, employmentStatus: employed },
        _count: { _all: true },
      }),
      prisma.staff.groupBy({
        by: ["campusId"],
        where: { schoolId, employmentStatus: employed },
        _count: { _all: true },
      }),
      prisma.staff.findMany({
        where: { schoolId, employmentStatus: employed },
        select: { id: true, fullName: true, dateOfBirth: true, joiningDate: true },
      }),
    ]);

    const nonTeachingStaff = await prisma.staff.count({
      where: { schoolId, category: { not: "teacher" }, employmentStatus: employed },
    });

    // Resolve group-by ids to names in one round trip each.
    const [departments, employeeTypes, campuses] = await Promise.all([
      prisma.department.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      prisma.employeeType.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      prisma.campus.findMany({ where: { schoolId }, select: { id: true, name: true } }),
    ]);

    const nameOf = (list: { id: string; name: string }[], id: string | null, fallback = "Unassigned") =>
      id ? (list.find((x) => x.id === id)?.name ?? fallback) : fallback;

    const upcomingBirthdays = dateRows
      .filter((s) => withinUpcomingWindow(s.dateOfBirth, UPCOMING_WINDOW_DAYS))
      .map((s) => ({ id: s.id, fullName: s.fullName, date: s.dateOfBirth }));

    const workAnniversaries = dateRows
      .filter((s) => s.joiningDate && withinUpcomingWindow(s.joiningDate, UPCOMING_WINDOW_DAYS))
      .map((s) => ({
        id: s.id,
        fullName: s.fullName,
        date: s.joiningDate,
        years: s.joiningDate ? now.getFullYear() - s.joiningDate.getFullYear() : null,
      }))
      .filter((s) => (s.years ?? 0) > 0);

    // Recruitment figures are included only for roles that may see them.
    const canSeeRecruitment = await currentUserCan("recruitment", "view");
    const recruitment = canSeeRecruitment
      ? await (async () => {
          const [openVacancies, totalCandidates, byStage, interviewsToday] = await Promise.all([
            prisma.vacancy.count({ where: { schoolId, status: "open" } }),
            prisma.candidate.count({ where: { schoolId } }),
            prisma.application.groupBy({ by: ["status"], where: { schoolId }, _count: { _all: true } }),
            prisma.interview.count({
              where: {
                schoolId,
                status: "scheduled",
                scheduledAt: {
                  gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                  lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
                },
              },
            }),
          ]);

          const stageCount = (stage: string) => byStage.find((s) => s.status === stage)?._count._all ?? 0;

          return {
            openVacancies,
            totalCandidates,
            interviewsToday,
            funnel: {
              applications: byStage.reduce((sum, s) => sum + s._count._all, 0),
              screening: stageCount("screening"),
              shortlisted: stageCount("shortlisted"),
              interview: stageCount("interview"),
              selected: stageCount("selected"),
              offered: stageCount("offered"),
              joined: stageCount("joined"),
              rejected: stageCount("rejected"),
            },
          };
        })()
      : null;

    // Alerts are derived from the counts above — never hardcoded copy.
    const alerts: { id: string; severity: "info" | "warning"; message: string; href: string }[] = [];
    if (expiringDocuments > 0) {
      alerts.push({
        id: "documents-expiring",
        severity: "warning",
        message: `${expiringDocuments} employee document${expiringDocuments === 1 ? "" : "s"} expire within ${DOCUMENT_EXPIRY_WINDOW_DAYS} days.`,
        href: "/employees?documentStatus=expiring",
      });
    }
    if (pendingDocuments > 0) {
      alerts.push({
        id: "documents-pending",
        severity: "info",
        message: `${pendingDocuments} document${pendingDocuments === 1 ? "" : "s"} awaiting verification.`,
        href: "/employees",
      });
    }
    if (onProbation > 0) {
      alerts.push({
        id: "probation",
        severity: "info",
        message: `${onProbation} employee${onProbation === 1 ? " is" : "s are"} currently on probation.`,
        href: "/employees?employmentStatus=probation",
      });
    }
    if (noticePeriod > 0) {
      alerts.push({
        id: "notice",
        severity: "warning",
        message: `${noticePeriod} employee${noticePeriod === 1 ? " is" : "s are"} serving notice.`,
        href: "/employees?employmentStatus=notice_period",
      });
    }

    return NextResponse.json({
      kpis: {
        totalEmployees,
        teachingStaff,
        nonTeachingStaff,
        activeEmployees,
        onProbation,
        onLeave,
        noticePeriod,
        newJoiners,
        expiringDocuments,
        pendingDocuments,
      },
      charts: {
        byDepartment: byDepartment.map((r) => ({
          label: nameOf(departments, r.departmentId),
          value: r._count._all,
        })),
        byEmployeeType: byEmployeeType.map((r) => ({
          label: nameOf(employeeTypes, r.employeeTypeId, "Not set"),
          value: r._count._all,
        })),
        byGender: byGender.map((r) => ({
          label: r.gender ? r.gender[0].toUpperCase() + r.gender.slice(1) : "Not recorded",
          value: r._count._all,
        })),
        byCampus: byCampus.map((r) => ({ label: nameOf(campuses, r.campusId), value: r._count._all })),
        teachingSplit: [
          { label: "Teaching", value: teachingStaff },
          { label: "Non-teaching", value: nonTeachingStaff },
        ],
      },
      upcoming: { birthdays: upcomingBirthdays, anniversaries: workAnniversaries },
      alerts,
      recruitment,
      /** Modules not yet built — the UI renders these as explicit placeholders. */
      unavailable: ["attendance", "leave", "payroll", "performance"],
    });
  } catch (error) {
    return apiError(error);
  }
}
