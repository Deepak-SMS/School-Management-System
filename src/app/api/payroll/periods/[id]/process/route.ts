import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { payrollProcessSchema } from "@/lib/validation/payroll";
import { apiError } from "@/lib/api-error";
import { calculatePay } from "@/lib/payroll/calculate";
import { monthlySummary } from "@/lib/hr/staff-attendance";
import { staffGroup } from "@/lib/hr/work-calendar";

/**
 * Runs (or re-runs) payroll for a period: for every eligible active staff
 * member, resolves their current salary structure, reads this month's
 * attendance summary (the same `payableDays` figure the HR module already
 * computes), and writes a calculated PayrollEntry. Re-running before
 * approval simply recalculates in place (upsert) — once approved or locked,
 * this route refuses, and the period must be reopened first.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "create");
    const { schoolId } = user;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const input = payrollProcessSchema.parse(body);

    const period = await prisma.payrollPeriod.findFirst({ where: { id, schoolId } });
    if (!period) return NextResponse.json({ error: "Payroll period not found." }, { status: 404 });
    if (period.status === "approved" || period.status === "locked") {
      return NextResponse.json({ error: `This period is ${period.status} — reopen it before reprocessing.` }, { status: 409 });
    }

    const periodStart = new Date(period.year, period.month - 1, 1);
    const periodEnd = new Date(period.year, period.month, 0);

    const rules = await prisma.payrollRule.findMany({
      where: { schoolId, status: "active", effectiveDate: { lte: periodStart } },
      orderBy: { effectiveDate: "desc" },
    });
    const latestRuleByType = new Map<string, (typeof rules)[number]>();
    for (const r of rules) if (!latestRuleByType.has(r.ruleType)) latestRuleByType.set(r.ruleType, r);
    const activeRules = Array.from(latestRuleByType.values());

    const staffList = await prisma.staff.findMany({
      where: {
        schoolId,
        employmentStatus: { notIn: ["resigned", "terminated", "retired"] },
        ...(input.staffIds && input.staffIds.length > 0 && { id: { in: input.staffIds } }),
      },
      select: { id: true, category: true },
    });

    const { summaries } = await monthlySummary(schoolId, period.year, period.month, {});
    const summaryByStaff = new Map(summaries.map((s) => [s.staffId, s]));

    const assignments = await prisma.salaryStructureAssignment.findMany({
      where: {
        schoolId,
        staffId: { in: staffList.map((s) => s.id) },
        effectiveFrom: { lte: periodEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
      },
      include: { structure: { include: { items: { include: { component: true } } } } },
      orderBy: { effectiveFrom: "desc" },
    });
    const assignmentByStaff = new Map<string, (typeof assignments)[number]>();
    for (const a of assignments) if (!assignmentByStaff.has(a.staffId)) assignmentByStaff.set(a.staffId, a);

    const processed: string[] = [];
    const skipped: { staffId: string; reason: string }[] = [];

    for (const staff of staffList) {
      const assignment = assignmentByStaff.get(staff.id);
      if (!assignment) {
        skipped.push({ staffId: staff.id, reason: "No salary structure assigned" });
        continue;
      }
      const summary = summaryByStaff.get(staff.id);
      if (!summary) {
        skipped.push({ staffId: staff.id, reason: "No attendance data for this month" });
        continue;
      }
      if (summary.unmarked > 0) {
        skipped.push({ staffId: staff.id, reason: `${summary.unmarked} day(s) of attendance not marked yet` });
        continue;
      }

      const pay = calculatePay({
        structure: assignment.structure,
        workingDays: summary.workingDays,
        payableDays: summary.payableDays,
        employeeGroup: staffGroup(staff.category),
        rules: activeRules,
      });

      await prisma.payrollEntry.upsert({
        where: { periodId_staffId: { periodId: id, staffId: staff.id } },
        create: {
          schoolId,
          periodId: id,
          staffId: staff.id,
          structureId: assignment.structureId,
          workingDays: summary.workingDays,
          payableDays: summary.payableDays,
          grossSalary: pay.grossSalary,
          totalDeductions: pay.totalDeductions,
          netSalary: pay.netSalary,
          earningsJson: JSON.stringify(pay.earnings),
          deductionsJson: JSON.stringify(pay.deductions),
          status: "calculated",
        },
        update: {
          structureId: assignment.structureId,
          workingDays: summary.workingDays,
          payableDays: summary.payableDays,
          grossSalary: pay.grossSalary,
          totalDeductions: pay.totalDeductions,
          netSalary: pay.netSalary,
          earningsJson: JSON.stringify(pay.earnings),
          deductionsJson: JSON.stringify(pay.deductions),
          status: "calculated",
        },
      });
      processed.push(staff.id);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.payrollPeriod.update({ where: { id }, data: { status: "processed", processedAt: new Date() } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "payrollPeriod.process",
        entityType: "PayrollPeriod",
        entityId: id,
        after: { processedCount: processed.length, skippedCount: skipped.length },
      });
      return row;
    });

    return NextResponse.json({ period: updated, processedCount: processed.length, skipped });
  } catch (error) {
    return apiError(error);
  }
}
