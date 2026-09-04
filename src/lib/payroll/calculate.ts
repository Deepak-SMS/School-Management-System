import type { Prisma } from "@/generated/prisma/client";
import { BASIC_COMPONENT_CODE, PAYROLL_RULE_TYPE_LABELS } from "@/lib/constants/payroll";

/**
 * The payroll calculation engine.
 *
 * Deliberately simple: a component is either a fixed amount or a percentage
 * of whichever component is coded "BASIC" — `calculationType: "formula"` is
 * declared on the schema for later, but resolves to 0 until a formula
 * evaluator actually exists (see resolveComponentAmounts below), rather than
 * half-building one now.
 *
 * "Gross Salary" is always the structure's full entitlement — never silently
 * pro-rated — matching how a real payslip reads: Gross, then a visible
 * "Loss of Pay" deduction line for the unpaid/absent days, then Net. This is
 * what makes the printed slip explain itself instead of just showing a
 * smaller number with no reason attached.
 */

export interface PayLine {
  label: string;
  amount: number;
}

export interface CalculatedPay {
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  earnings: PayLine[];
  deductions: PayLine[];
}

type StructureWithItems = Prisma.SalaryStructureGetPayload<{
  include: { items: { include: { component: true } } };
}>;

export interface PayrollRuleInput {
  ruleType: string;
  rate: number | null;
  thresholdAmount: number | null;
  employeeContributionPercent: number | null;
  applicableEmployeeGroup: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resolves one structure's components to concrete amounts. `percentage_of_basic`
 * components resolve against whichever component in the SAME structure has
 * `code === "BASIC"` — the one convention this engine relies on rather than a
 * general formula evaluator.
 */
function resolveComponentAmounts(
  structure: StructureWithItems,
): { label: string; type: string; amount: number }[] {
  const basicItem = structure.items.find((i) => i.component.code === BASIC_COMPONENT_CODE);
  const basicAmount = basicItem ? (basicItem.amount ?? basicItem.component.amount ?? 0) : 0;

  return structure.items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => {
      const { component } = item;
      let amount = 0;
      if (component.calculationType === "fixed") {
        amount = item.amount ?? component.amount ?? 0;
      } else if (component.calculationType === "percentage_of_basic") {
        const pct = item.percentage ?? component.percentage ?? 0;
        amount = (basicAmount * pct) / 100;
      }
      return { label: component.name, type: component.componentType, amount };
    });
}

export function calculatePay(params: {
  structure: StructureWithItems;
  workingDays: number;
  payableDays: number;
  employeeGroup: "teaching" | "non_teaching";
  rules: PayrollRuleInput[];
}): CalculatedPay {
  const resolved = resolveComponentAmounts(params.structure);
  const earningLines = resolved.filter((r) => r.type === "earning" && r.amount > 0);
  const structureDeductionLines = resolved.filter((r) => r.type === "deduction" && r.amount > 0);

  const grossSalary = earningLines.reduce((sum, r) => sum + r.amount, 0);

  const lossOfPayDays = Math.max(0, params.workingDays - params.payableDays);
  const lossOfPayAmount = params.workingDays > 0 ? (grossSalary * lossOfPayDays) / params.workingDays : 0;
  const proRatedGross = grossSalary - lossOfPayAmount;

  const deductions: PayLine[] = [];
  if (lossOfPayAmount > 0) {
    deductions.push({
      label: `Loss of Pay (${lossOfPayDays} day${lossOfPayDays === 1 ? "" : "s"})`,
      amount: round2(lossOfPayAmount),
    });
  }
  for (const d of structureDeductionLines) {
    deductions.push({ label: d.label, amount: round2(d.amount) });
  }

  // Statutory deductions apply against the pro-rated gross, not the full
  // entitlement — a month with unpaid leave owes less PF/ESI/PT/TDS too.
  for (const rule of params.rules) {
    if (rule.applicableEmployeeGroup !== "all" && rule.applicableEmployeeGroup !== params.employeeGroup) continue;
    if (rule.thresholdAmount != null && proRatedGross > rule.thresholdAmount) continue;
    let amount = 0;
    if (rule.employeeContributionPercent != null) amount = (proRatedGross * rule.employeeContributionPercent) / 100;
    else if (rule.rate != null) amount = rule.rate;
    if (amount > 0) {
      deductions.push({ label: PAYROLL_RULE_TYPE_LABELS[rule.ruleType as keyof typeof PAYROLL_RULE_TYPE_LABELS] ?? rule.ruleType, amount: round2(amount) });
    }
  }

  const totalDeductions = round2(deductions.reduce((sum, d) => sum + d.amount, 0));

  return {
    grossSalary: round2(grossSalary),
    totalDeductions,
    netSalary: round2(grossSalary - totalDeductions),
    earnings: earningLines.map((e) => ({ label: e.label, amount: round2(e.amount) })),
    deductions,
  };
}
