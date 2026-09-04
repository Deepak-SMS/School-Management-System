import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { saveFile } from "@/lib/storage";
import { readBytesFromStoredUrl } from "@/lib/id-cards/card-assets";
import { nextSalarySlipNumber } from "@/lib/payroll/numbering";
import { renderSalarySlipPdf } from "@/lib/pdf/render-salary-slip-pdf";
import type { PayLine } from "@/lib/payroll/calculate";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Generates the numbered PDF slip for every entry in a locked period that doesn't already have one. Never regenerates an existing slip — a corrected period must be reopened, reprocessed, and its slips explicitly cleared first, not silently overwritten. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "approve");
    const { schoolId } = user;
    const { id } = await params;

    const period = await prisma.payrollPeriod.findFirst({ where: { id, schoolId } });
    if (!period) return NextResponse.json({ error: "Payroll period not found." }, { status: 404 });
    if (period.status !== "locked") {
      return NextResponse.json({ error: "Lock the period before generating salary slips." }, { status: 409 });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return NextResponse.json({ error: "School not found." }, { status: 404 });
    const logoBytes = await readBytesFromStoredUrl(school.logoUrl);

    const entries = await prisma.payrollEntry.findMany({
      where: { periodId: id },
      include: {
        staff: { select: { fullName: true, employeeId: true, designation: { select: { name: true } }, department: { select: { name: true } }, bankName: true, bankAccountNumber: true } },
        slip: { select: { id: true } },
      },
    });

    const payPeriodLabel = `${MONTH_NAMES[period.month - 1]} ${period.year}`;
    let generated = 0;
    let alreadyExisted = 0;

    for (const entry of entries) {
      if (entry.slip) {
        alreadyExisted++;
        continue;
      }

      const earnings = JSON.parse(entry.earningsJson) as PayLine[];
      const deductions = JSON.parse(entry.deductionsJson) as PayLine[];

      // Reserve the number first — it's printed on the slip itself.
      const slipNumber = await prisma.$transaction((tx) => nextSalarySlipNumber(tx, { schoolId, year: period.year }));

      const pdf = await renderSalarySlipPdf({
        slipNumber,
        generatedAt: new Date(),
        schoolName: school.name,
        schoolAddress: [school.address, school.city, school.state].filter(Boolean).join(", "),
        schoolPhone: school.phone,
        schoolEmail: school.email,
        employeeName: entry.staff.fullName,
        employeeId: entry.staff.employeeId,
        designation: entry.staff.designation?.name,
        department: entry.staff.department?.name,
        payPeriodLabel,
        bankAccountNumber: entry.staff.bankAccountNumber,
        bankName: entry.staff.bankName,
        workingDays: entry.workingDays,
        payableDays: entry.payableDays,
        earnings,
        deductions,
        grossSalary: entry.grossSalary,
        totalDeductions: entry.totalDeductions,
        netSalary: entry.netSalary,
        logoBytes,
      });

      const { id: pdfFileId } = await saveFile({
        schoolId,
        kind: "generated_pdf",
        fileName: `${slipNumber.replace(/\//g, "_")}.pdf`,
        data: pdf,
        mimeType: "application/pdf",
      });

      await prisma.$transaction(async (tx) => {
        await tx.salarySlip.create({ data: { schoolId, entryId: entry.id, slipNumber, pdfFileId } });
        await recordAudit(tx, { schoolId, userId: user.id, action: "salarySlip.generate", entityType: "PayrollEntry", entityId: entry.id, after: { slipNumber } });
      });
      generated++;
    }

    return NextResponse.json({ generated, alreadyExisted });
  } catch (error) {
    return apiError(error);
  }
}
