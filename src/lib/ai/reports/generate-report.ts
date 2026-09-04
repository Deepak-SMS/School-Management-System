import { prisma } from "@/lib/db";
import { generateReportSections } from "@/lib/ai/analytics/narrate";
import { getAttendanceOverview, getLowAttendanceStudents } from "@/lib/ai/analytics/attendance-analytics";
import { getFeesOverview, getFeeDefaulters } from "@/lib/ai/analytics/fees-analytics";
import { getStaffAttendanceOverview } from "@/lib/ai/analytics/staff-attendance-analytics";
import type { GeneratedReport, ReportFilters, ReportType } from "@/lib/ai/reports/types";
import { REPORT_TYPES } from "@/lib/ai/reports/types";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function money(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

async function filtersLabel(f: ReportFilters): Promise<string> {
  const parts: string[] = [];
  if (f.classId) {
    const cls = await prisma.class.findUnique({ where: { id: f.classId }, select: { name: true } });
    if (cls) parts.push(cls.name);
  }
  if (f.sectionId) {
    const section = await prisma.section.findUnique({ where: { id: f.sectionId }, select: { name: true } });
    if (section) parts.push(section.name);
  }
  return parts.length ? parts.join(" · ") : "All classes";
}

export async function generateReport(reportType: ReportType, filters: ReportFilters): Promise<GeneratedReport> {
  const title = REPORT_TYPES.find((r) => r.value === reportType)?.label ?? reportType;
  const periodLabel = `${formatDate(filters.from)} – ${formatDate(filters.to)}`;
  const filtersLabelText = await filtersLabel(filters);
  const generatedAt = new Date().toISOString();
  const base = { reportType, title, generatedAt, periodLabel, filtersLabel: filtersLabelText };

  if (reportType === "attendance") {
    const [overview, lowAttendance] = await Promise.all([getAttendanceOverview(filters), getLowAttendanceStudents({ ...filters, thresholdPct: 75 })]);
    const sections = await generateReportSections(
      title,
      { overview, studentsBelow75PctCount: lowAttendance.length },
      "Note the overall attendance percentage and how many students fell below 75% attendance.",
    );
    return {
      ...base,
      keyStatistics: [
        { label: "Overall attendance", value: `${overview.attendancePct}%` },
        { label: "Days marked", value: String(overview.totalMarked) },
        { label: "Present", value: String(overview.present) },
        { label: "Absent", value: String(overview.absent) },
        { label: "Students below 75%", value: String(lowAttendance.length) },
      ],
      ...sections,
      tableTitle: "Students below 75% attendance",
      tableColumns: ["Student", "Class", "Section", "Present / Total", "%"],
      tableRows: lowAttendance.map((s) => [s.name, s.className, s.sectionName ?? "—", `${s.presentDays} / ${s.totalDays}`, `${s.pct}%`]),
    };
  }

  if (reportType === "fee_collection") {
    const overview = await getFeesOverview(filters);
    const sections = await generateReportSections(title, overview, "Note the collection percentage and total pending/overdue amounts.");
    return {
      ...base,
      keyStatistics: [
        { label: "Total charged", value: money(overview.totalCharged) },
        { label: "Total collected", value: money(overview.totalPaid) },
        { label: "Pending", value: money(overview.totalPending) },
        { label: "Overdue", value: money(overview.totalOverdue) },
        { label: "Collection rate", value: `${overview.collectionPct}%` },
      ],
      ...sections,
      tableTitle: "Class-wise collection",
      tableColumns: ["Class", "Charged", "Collected", "Pending"],
      tableRows: overview.classWise.map((c) => [c.className, money(c.charged), money(c.paid), money(c.pending)]),
    };
  }

  if (reportType === "fee_defaulters") {
    const defaulters = await getFeeDefaulters(filters);
    const totalOverdue = defaulters.reduce((sum, d) => sum + d.overdue, 0);
    const sections = await generateReportSections(
      title,
      { defaulterCount: defaulters.length, totalOverdue, top5: defaulters.slice(0, 5) },
      "Note how many students are in default and the total amount overdue.",
    );
    return {
      ...base,
      keyStatistics: [
        { label: "Defaulters", value: String(defaulters.length) },
        { label: "Total overdue", value: money(totalOverdue) },
      ],
      ...sections,
      tableTitle: "Fee defaulters",
      tableColumns: ["Student", "Class", "Section", "Pending", "Overdue"],
      tableRows: defaulters.map((d) => [d.name, d.className, d.sectionName ?? "—", money(d.pending), money(d.overdue)]),
    };
  }

  // staff_attendance
  const overview = await getStaffAttendanceOverview({ ...filters, thresholdPct: 75 });
  const sections = await generateReportSections(
    title,
    { overview, staffBelow75PctCount: overview.belowThreshold.length },
    "Note the overall staff attendance percentage and how many staff members fell below 75% attendance.",
  );
  return {
    ...base,
    keyStatistics: [
      { label: "Overall attendance", value: `${overview.attendancePct}%` },
      { label: "Present", value: String(overview.present) },
      { label: "Absent", value: String(overview.absent) },
      { label: "On leave", value: String(overview.onLeave) },
      { label: "Staff below 75%", value: String(overview.belowThreshold.length) },
    ],
    ...sections,
    tableTitle: "Staff below 75% attendance",
    tableColumns: ["Staff", "Designation", "Present / Total", "%"],
    tableRows: overview.belowThreshold.map((s) => [s.name, s.designation ?? "—", `${s.presentDays} / ${s.totalDays}`, `${s.pct}%`]),
  };
}
