import { prisma } from "@/lib/db";
import { DATASETS, type Dataset, type DatasetColumn } from "@/lib/database/datasets";
import type { ReadSheet } from "@/lib/database/workbook";

/**
 * Turning an uploaded workbook back into records.
 *
 * Two passes, always: `planImport` reads and checks everything and writes
 * nothing, and only if the administrator accepts the plan does `applyImport`
 * write. A file that is half-valid never lands half-imported — the whole
 * commit runs in one transaction and either all of it holds or none does.
 *
 * Matching is by natural key (admission number, employee id, code), so
 * re-importing an exported workbook updates the same records instead of
 * duplicating them. Nothing here ever deletes: a row removed from the
 * spreadsheet leaves the record alone, because "I deleted a line in Excel"
 * is not a safe way to remove a student.
 */

export interface ImportIssue {
  sheet: string;
  /** Row number as the spreadsheet shows it, so it can be found and fixed. */
  row: number;
  column?: string;
  message: string;
}

export interface SheetPlan {
  sheet: string;
  datasetKey: string;
  label: string;
  create: number;
  update: number;
  skipped: number;
}

export interface ImportPlan {
  sheets: SheetPlan[];
  issues: ImportIssue[];
  unknownSheets: string[];
  totalCreate: number;
  totalUpdate: number;
}

/** Lookups shared by every sheet, loaded once per import. */
interface Context {
  campuses: Map<string, string>;
  academicYears: Map<string, string>;
  classes: Map<string, { id: string; academicYearId: string; campusId: string }>;
  sections: Map<string, string>;
  subjects: Map<string, string>;
  departments: Map<string, string>;
  designations: Map<string, string>;
  employeeTypes: Map<string, string>;
  staff: Map<string, string>;
  students: Map<string, string>;
  /** "<studentId>|<relationship>|<guardian name>" → link id. */
  guardianLinks: Map<string, string>;
}

function key(value: string): string {
  return value.trim().toLowerCase();
}

async function loadContext(schoolId: string): Promise<Context> {
  const [campuses, years, classes, sections, subjects, departments, designations, employeeTypes, staff, students, guardianLinks] =
    await Promise.all([
      prisma.campus.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      prisma.academicYear.findMany({ where: { schoolId }, select: { id: true, label: true } }),
      prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, academicYearId: true, campusId: true, academicYear: { select: { label: true } } },
      }),
      prisma.section.findMany({ where: { schoolId }, select: { id: true, name: true, classId: true } }),
      prisma.subject.findMany({ where: { schoolId }, select: { id: true, code: true } }),
      prisma.department.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      prisma.designation.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      prisma.employeeType.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      prisma.staff.findMany({ where: { schoolId }, select: { id: true, employeeId: true } }),
      prisma.student.findMany({ where: { schoolId }, select: { id: true, admissionNumber: true } }),
      prisma.studentGuardian.findMany({
        where: { student: { schoolId } },
        select: { id: true, studentId: true, relationship: true, guardian: { select: { fullName: true } } },
      }),
    ]);

  return {
    campuses: new Map(campuses.map((c) => [key(c.name), c.id])),
    academicYears: new Map(years.map((y) => [key(y.label), y.id])),
    // Class names repeat across years, so the year is part of the key.
    classes: new Map(
      classes.map((c) => [
        `${key(c.name)}|${key(c.academicYear.label)}`,
        { id: c.id, academicYearId: c.academicYearId, campusId: c.campusId },
      ]),
    ),
    sections: new Map(sections.map((s) => [`${s.classId}|${key(s.name)}`, s.id])),
    subjects: new Map(subjects.map((s) => [key(s.code), s.id])),
    departments: new Map(departments.map((d) => [key(d.name), d.id])),
    designations: new Map(designations.map((d) => [key(d.name), d.id])),
    employeeTypes: new Map(employeeTypes.map((t) => [key(t.name), t.id])),
    staff: new Map(staff.map((s) => [key(s.employeeId), s.id])),
    students: new Map(students.map((s) => [key(s.admissionNumber), s.id])),
    guardianLinks: new Map(
      guardianLinks.map((g) => [`${g.studentId}|${key(g.relationship)}|${key(g.guardian.fullName)}`, g.id]),
    ),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A row after header→field mapping, with the issues found while checking it. */
interface CheckedRow {
  rowNumber: number;
  values: Record<string, string>;
  issues: ImportIssue[];
}

function mapAndCheck(sheet: ReadSheet, dataset: Dataset, columns: DatasetColumn[]): CheckedRow[] {
  const byHeader = new Map(columns.map((c) => [c.header.toLowerCase(), c]));

  return sheet.rows.map((row) => {
    const values: Record<string, string> = {};
    const issues: ImportIssue[] = [];

    for (const [header, raw] of Object.entries(row.values)) {
      const column = byHeader.get(header.trim().toLowerCase());
      if (column) values[column.field] = raw.trim();
    }

    for (const column of columns) {
      const value = values[column.field] ?? "";

      if (column.required && !value) {
        issues.push({ sheet: sheet.name, row: row.rowNumber, column: column.header, message: "Required value is missing" });
        continue;
      }
      if (!value) continue;

      if (column.allowed) {
        // Matched case-insensitively and then snapped to the canonical spelling,
        // so "Active" and "a+" are accepted and stored as "active" and "A+".
        const canonical = column.allowed.find((a) => a.toLowerCase() === value.toLowerCase());
        if (canonical) {
          values[column.field] = canonical;
        } else {
          issues.push({
            sheet: sheet.name,
            row: row.rowNumber,
            column: column.header,
            message: `"${value}" is not allowed here. Use one of: ${column.allowed.join(", ")}`,
          });
        }
      }
      if (/date|Date$/.test(column.field) && !DATE_RE.test(value)) {
        issues.push({
          sheet: sheet.name,
          row: row.rowNumber,
          column: column.header,
          message: `"${value}" is not a date. Write it as YYYY-MM-DD`,
        });
      }
      if (/capacity|marks|level|sortOrder|credits/i.test(column.field) && Number.isNaN(Number(value))) {
        issues.push({
          sheet: sheet.name,
          row: row.rowNumber,
          column: column.header,
          message: `"${value}" is not a number`,
        });
      }
    }

    return { rowNumber: row.rowNumber, values, issues };
  });
}

/** Sheets are written in this order so a class exists before a section points at it. */
const IMPORT_ORDER = [
  "campuses",
  "academicYears",
  "classes",
  "sections",
  "subjects",
  "departments",
  "designations",
  "employeeTypes",
  "employees",
  "students",
  "guardians",
];

function matchDataset(sheetName: string): Dataset | undefined {
  const name = key(sheetName);
  return DATASETS.find((d) => key(d.label) === name || key(d.key) === name);
}

export interface PreparedSheet {
  dataset: Dataset;
  sheetName: string;
  rows: CheckedRow[];
}

/**
 * Reads the workbook against the registry: which sheets are recognised, which
 * rows are valid, and what each row would do. Writes nothing.
 */
export async function planImport(
  schoolId: string,
  sheets: ReadSheet[],
  columnsFor: (dataset: Dataset) => DatasetColumn[],
): Promise<{ plan: ImportPlan; prepared: PreparedSheet[] }> {
  const context = await loadContext(schoolId);

  const issues: ImportIssue[] = [];
  const unknownSheets: string[] = [];
  const prepared: PreparedSheet[] = [];
  const sheetPlans: SheetPlan[] = [];

  for (const sheet of sheets) {
    const dataset = matchDataset(sheet.name);
    if (!dataset) {
      unknownSheets.push(sheet.name);
      continue;
    }
    if (!dataset.importable) continue;
    if (sheet.rows.length === 0) continue;

    const columns = columnsFor(dataset);
    const rows = mapAndCheck(sheet, dataset, columns);

    // References are checked against what's already in the database plus what
    // earlier sheets in this same file will create, so a workbook that adds a
    // class and a section for it in one go validates.
    let create = 0;
    let update = 0;
    for (const row of rows) {
      const refIssues = checkReferences(dataset, sheet.name, row, context);
      row.issues.push(...refIssues);

      const existing = existingId(dataset, row, context);
      if (existing) update += 1;
      else {
        create += 1;
        registerPending(dataset, row, context);
      }
    }

    issues.push(...rows.flatMap((r) => r.issues));
    prepared.push({ dataset, sheetName: sheet.name, rows });
    sheetPlans.push({
      sheet: sheet.name,
      datasetKey: dataset.key,
      label: dataset.label,
      create,
      update,
      skipped: rows.filter((r) => r.issues.length > 0).length,
    });
  }

  prepared.sort((a, b) => IMPORT_ORDER.indexOf(a.dataset.key) - IMPORT_ORDER.indexOf(b.dataset.key));

  return {
    plan: {
      sheets: sheetPlans,
      issues,
      unknownSheets,
      totalCreate: sheetPlans.reduce((n, s) => n + s.create, 0),
      totalUpdate: sheetPlans.reduce((n, s) => n + s.update, 0),
    },
    prepared,
  };
}

function existingId(dataset: Dataset, row: CheckedRow, ctx: Context): string | undefined {
  const v = row.values;
  switch (dataset.key) {
    case "campuses":
      return ctx.campuses.get(key(v.name ?? ""));
    case "academicYears":
      return ctx.academicYears.get(key(v.label ?? ""));
    case "classes":
      return ctx.classes.get(`${key(v.name ?? "")}|${key(v.academicYear ?? "")}`)?.id;
    case "sections": {
      const cls = ctx.classes.get(`${key(v.class ?? "")}|${key(v.academicYear ?? "")}`);
      return cls ? ctx.sections.get(`${cls.id}|${key(v.name ?? "")}`) : undefined;
    }
    case "subjects":
      return ctx.subjects.get(key(v.code ?? ""));
    case "departments":
      return ctx.departments.get(key(v.name ?? ""));
    case "designations":
      return ctx.designations.get(key(v.name ?? ""));
    case "employeeTypes":
      return ctx.employeeTypes.get(key(v.name ?? ""));
    case "employees":
      return ctx.staff.get(key(v.employeeId ?? ""));
    case "students":
      return ctx.students.get(key(v.admissionNumber ?? ""));
    case "guardians": {
      const studentId = ctx.students.get(key(v.admissionNumber ?? ""));
      if (!studentId) return undefined;
      return ctx.guardianLinks.get(`${studentId}|${key(v.relationship ?? "")}|${key(v.fullName ?? "")}`);
    }
    default:
      return undefined;
  }
}

/** Marks a to-be-created record as resolvable, so later sheets can reference it. */
function registerPending(dataset: Dataset, row: CheckedRow, ctx: Context) {
  const v = row.values;
  const PENDING = "pending";
  switch (dataset.key) {
    case "campuses":
      ctx.campuses.set(key(v.name ?? ""), PENDING);
      break;
    case "academicYears":
      ctx.academicYears.set(key(v.label ?? ""), PENDING);
      break;
    case "classes":
      ctx.classes.set(`${key(v.name ?? "")}|${key(v.academicYear ?? "")}`, {
        id: PENDING,
        academicYearId: PENDING,
        campusId: PENDING,
      });
      break;
    case "departments":
      ctx.departments.set(key(v.name ?? ""), PENDING);
      break;
    case "designations":
      ctx.designations.set(key(v.name ?? ""), PENDING);
      break;
    case "employeeTypes":
      ctx.employeeTypes.set(key(v.name ?? ""), PENDING);
      break;
    case "employees":
      ctx.staff.set(key(v.employeeId ?? ""), PENDING);
      break;
    case "students":
      ctx.students.set(key(v.admissionNumber ?? ""), PENDING);
      break;
    default:
      break;
  }
}

function missing(sheet: string, row: number, column: string, what: string, value: string): ImportIssue {
  return { sheet, row, column, message: `${what} "${value}" doesn't exist. Create it first, or add it to its own sheet.` };
}

function checkReferences(dataset: Dataset, sheet: string, row: CheckedRow, ctx: Context): ImportIssue[] {
  const v = row.values;
  const out: ImportIssue[] = [];
  const n = row.rowNumber;

  const needYear = (value: string, column: string) => {
    if (value && !ctx.academicYears.has(key(value))) out.push(missing(sheet, n, column, "Academic year", value));
  };
  const needCampus = (value: string, column: string) => {
    if (value && !ctx.campuses.has(key(value))) out.push(missing(sheet, n, column, "Campus", value));
  };
  const needStaff = (value: string, column: string) => {
    if (value && !ctx.staff.has(key(value))) out.push(missing(sheet, n, column, "Employee", value));
  };

  switch (dataset.key) {
    case "classes":
      needYear(v.academicYear ?? "", "Academic Year");
      needCampus(v.campus ?? "", "Campus");
      needStaff(v.classTeacher ?? "", "Class Teacher");
      break;
    case "sections": {
      needYear(v.academicYear ?? "", "Academic Year");
      needStaff(v.classTeacher ?? "", "Class Teacher");
      const cls = ctx.classes.get(`${key(v.class ?? "")}|${key(v.academicYear ?? "")}`);
      if (v.class && !cls) out.push(missing(sheet, n, "Class", "Class", v.class));
      break;
    }
    case "departments":
      needCampus(v.campus ?? "", "Campus");
      needStaff(v.head ?? "", "Head");
      break;
    case "designations":
      if (v.department && !ctx.departments.has(key(v.department)))
        out.push(missing(sheet, n, "Department", "Department", v.department));
      break;
    case "employees":
      needCampus(v.campus ?? "", "Campus");
      needStaff(v.reportingManager ?? "", "Reporting Manager");
      if (v.department && !ctx.departments.has(key(v.department)))
        out.push(missing(sheet, n, "Department", "Department", v.department));
      if (v.designation && !ctx.designations.has(key(v.designation)))
        out.push(missing(sheet, n, "Designation", "Designation", v.designation));
      if (v.employeeType && !ctx.employeeTypes.has(key(v.employeeType)))
        out.push(missing(sheet, n, "Employee Type", "Employee type", v.employeeType));
      break;
    case "students": {
      needYear(v.academicYear ?? "", "Academic Year");
      const cls = ctx.classes.get(`${key(v.class ?? "")}|${key(v.academicYear ?? "")}`);
      if (v.class && !cls) out.push(missing(sheet, n, "Class", "Class", v.class));
      // A section is only checked against a class that already exists; one being
      // created in this same file has no sections to check against yet.
      if (v.section && cls && cls.id !== "pending" && !ctx.sections.has(`${cls.id}|${key(v.section)}`)) {
        out.push({
          sheet,
          row: n,
          column: "Section",
          message: `Section "${v.section}" doesn't exist in ${v.class}.`,
        });
      }
      break;
    }
    case "guardians":
      if (v.admissionNumber && !ctx.students.has(key(v.admissionNumber)))
        out.push(missing(sheet, n, "Admission Number", "Student", v.admissionNumber));
      break;
    default:
      break;
  }

  return out;
}

function optDate(value: string | undefined): Date | undefined {
  return value && DATE_RE.test(value) ? new Date(value) : undefined;
}

function optInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function optFloat(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function yes(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  return ["yes", "y", "true", "1"].includes(value.toLowerCase());
}

function blank(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

export interface ImportResult {
  created: number;
  updated: number;
  bySheet: { label: string; created: number; updated: number }[];
}

/**
 * Writes the prepared rows. One transaction for the whole workbook: a failure
 * on the last sheet rolls back the first, so the database is never left holding
 * half of someone's spreadsheet.
 */
export async function applyImport(schoolId: string, prepared: PreparedSheet[]): Promise<ImportResult> {
  return prisma.$transaction(
    async (tx) => {
      // Re-read inside the transaction: ids assigned as we go have to be
      // visible to the sheets that follow.
      const ctx = await loadContext(schoolId);
      const bySheet: ImportResult["bySheet"] = [];
      let created = 0;
      let updated = 0;

      for (const { dataset, rows } of prepared) {
        let sheetCreated = 0;
        let sheetUpdated = 0;

        for (const row of rows) {
          if (row.issues.length > 0) continue;
          const v = row.values;
          const existing = existingId(dataset, row, ctx);
          const isUpdate = Boolean(existing) && existing !== "pending";

          switch (dataset.key) {
            case "campuses": {
              const data = {
                name: v.name,
                code: v.code,
                campusType: blank(v.campusType) ?? "main",
                address: blank(v.address),
                city: blank(v.city),
                state: blank(v.state),
                country: blank(v.country),
                pinCode: blank(v.pinCode),
                phone: blank(v.phone),
                email: blank(v.email),
                website: blank(v.website),
                studentCapacity: optInt(v.studentCapacity),
                staffCapacity: optInt(v.staffCapacity),
                status: blank(v.status) ?? "active",
              };
              const saved = isUpdate
                ? await tx.campus.update({ where: { id: existing }, data })
                : await tx.campus.create({ data: { schoolId, ...data, name: data.name!, code: data.code! } });
              ctx.campuses.set(key(saved.name), saved.id);
              break;
            }

            case "academicYears": {
              const data = {
                label: v.label,
                startDate: optDate(v.startDate)!,
                endDate: optDate(v.endDate)!,
                admissionStartDate: optDate(v.admissionStartDate),
                admissionEndDate: optDate(v.admissionEndDate),
                status: blank(v.status) ?? "active",
              };
              const saved = isUpdate
                ? await tx.academicYear.update({ where: { id: existing }, data })
                : await tx.academicYear.create({ data: { schoolId, ...data, label: data.label! } });
              ctx.academicYears.set(key(saved.label), saved.id);
              break;
            }

            case "classes": {
              const academicYearId = ctx.academicYears.get(key(v.academicYear))!;
              const campusId = ctx.campuses.get(key(v.campus))!;
              const data = {
                name: v.name,
                code: v.code,
                academicYearId,
                campusId,
                sortOrder: optInt(v.sortOrder) ?? 0,
                capacity: optInt(v.capacity),
                classTeacherId: v.classTeacher ? ctx.staff.get(key(v.classTeacher)) : undefined,
                status: blank(v.status) ?? "active",
              };
              const saved = isUpdate
                ? await tx.class.update({ where: { id: existing }, data })
                : await tx.class.create({ data: { schoolId, ...data, name: data.name!, code: data.code! } });
              ctx.classes.set(`${key(saved.name)}|${key(v.academicYear)}`, {
                id: saved.id,
                academicYearId,
                campusId,
              });
              break;
            }

            case "sections": {
              const cls = ctx.classes.get(`${key(v.class)}|${key(v.academicYear)}`)!;
              const data = {
                name: v.name,
                code: v.code,
                classId: cls.id,
                academicYearId: cls.academicYearId,
                campusId: cls.campusId,
                room: blank(v.room),
                capacity: optInt(v.capacity),
                classTeacherId: v.classTeacher ? ctx.staff.get(key(v.classTeacher)) : undefined,
                status: blank(v.status) ?? "active",
              };
              const saved = isUpdate
                ? await tx.section.update({ where: { id: existing }, data })
                : await tx.section.create({ data: { schoolId, ...data, name: data.name!, code: data.code! } });
              ctx.sections.set(`${cls.id}|${key(saved.name)}`, saved.id);
              break;
            }

            case "subjects": {
              const data = {
                name: v.name,
                code: v.code,
                subjectType: blank(v.subjectType) ?? "core",
                natureType: blank(v.natureType) ?? "theory",
                description: blank(v.description),
                maxMarks: optInt(v.maxMarks),
                passingMarks: optInt(v.passingMarks),
                credits: optFloat(v.credits),
                status: blank(v.status) ?? "active",
              };
              const saved = isUpdate
                ? await tx.subject.update({ where: { id: existing }, data })
                : await tx.subject.create({ data: { schoolId, ...data, name: data.name!, code: data.code! } });
              ctx.subjects.set(key(saved.code), saved.id);
              break;
            }

            case "departments": {
              const data = {
                name: v.name,
                code: v.code,
                departmentType: blank(v.departmentType) ?? "administrative",
                campusId: v.campus ? ctx.campuses.get(key(v.campus)) : undefined,
                headStaffId: v.head ? ctx.staff.get(key(v.head)) : undefined,
                description: blank(v.description),
                email: blank(v.email),
                phone: blank(v.phone),
                status: blank(v.status) ?? "active",
              };
              const saved = isUpdate
                ? await tx.department.update({ where: { id: existing }, data })
                : await tx.department.create({ data: { schoolId, ...data, name: data.name!, code: data.code! } });
              ctx.departments.set(key(saved.name), saved.id);
              break;
            }

            case "designations": {
              const data = {
                name: v.name,
                code: v.code,
                departmentId: v.department ? ctx.departments.get(key(v.department)) : undefined,
                level: optInt(v.level) ?? 5,
                description: blank(v.description),
                status: blank(v.status) ?? "active",
              };
              const saved = isUpdate
                ? await tx.designation.update({ where: { id: existing }, data })
                : await tx.designation.create({ data: { schoolId, ...data, name: data.name!, code: data.code! } });
              ctx.designations.set(key(saved.name), saved.id);
              break;
            }

            case "employeeTypes": {
              const data = {
                name: v.name,
                code: v.code,
                isPaid: yes(v.isPaid) ?? true,
                sortOrder: optInt(v.sortOrder) ?? 0,
                status: blank(v.status) ?? "active",
              };
              const saved = isUpdate
                ? await tx.employeeType.update({ where: { id: existing }, data })
                : await tx.employeeType.create({ data: { schoolId, ...data, name: data.name!, code: data.code! } });
              ctx.employeeTypes.set(key(saved.name), saved.id);
              break;
            }

            case "employees": {
              const data = {
                employeeId: v.employeeId,
                fullName: v.fullName,
                firstName: blank(v.firstName),
                middleName: blank(v.middleName),
                lastName: blank(v.lastName),
                category: blank(v.category) ?? "other",
                dateOfBirth: optDate(v.dateOfBirth),
                gender: blank(v.gender),
                bloodGroup: blank(v.bloodGroup),
                maritalStatus: blank(v.maritalStatus),
                mobileNumber: v.mobileNumber,
                alternateNumber: blank(v.alternateNumber),
                email: blank(v.email),
                officialEmail: blank(v.officialEmail),
                departmentId: v.department ? ctx.departments.get(key(v.department)) : undefined,
                designationId: v.designation ? ctx.designations.get(key(v.designation)) : undefined,
                employeeTypeId: v.employeeType ? ctx.employeeTypes.get(key(v.employeeType)) : undefined,
                campusId: v.campus ? ctx.campuses.get(key(v.campus)) : undefined,
                reportingManagerId: v.reportingManager ? ctx.staff.get(key(v.reportingManager)) : undefined,
                joiningDate: optDate(v.joiningDate),
                confirmationDate: optDate(v.confirmationDate),
                probationEndDate: optDate(v.probationEndDate),
                employmentStatus: blank(v.employmentStatus) ?? "active",
                workLocation: blank(v.workLocation),
                address: blank(v.address),
                city: blank(v.city),
                state: blank(v.state),
                country: blank(v.country),
                pinCode: blank(v.pinCode),
                emergencyName: blank(v.emergencyName),
                emergencyRelation: blank(v.emergencyRelation),
                emergencyContact: blank(v.emergencyContact),
                // Absent from a redacted export, so undefined leaves them be
                // rather than wiping what's already stored.
                panNumber: blank(v.panNumber),
                bankName: blank(v.bankName),
                bankAccountNumber: blank(v.bankAccountNumber),
                bankIfsc: blank(v.bankIfsc),
                pfNumber: blank(v.pfNumber),
                esicNumber: blank(v.esicNumber),
              };
              const saved = isUpdate
                ? await tx.staff.update({ where: { id: existing }, data })
                : await tx.staff.create({
                    data: {
                      schoolId,
                      ...data,
                      employeeId: data.employeeId!,
                      fullName: data.fullName!,
                      mobileNumber: data.mobileNumber!,
                    },
                  });
              ctx.staff.set(key(saved.employeeId), saved.id);
              break;
            }

            case "students": {
              const cls = ctx.classes.get(`${key(v.class)}|${key(v.academicYear)}`)!;
              const sectionId = v.section ? ctx.sections.get(`${cls.id}|${key(v.section)}`) : undefined;
              const data = {
                admissionNumber: v.admissionNumber,
                enrollmentNumber: blank(v.enrollmentNumber),
                firstName: v.firstName,
                middleName: blank(v.middleName),
                lastName: v.lastName,
                dateOfBirth: optDate(v.dateOfBirth),
                gender: blank(v.gender),
                bloodGroup: blank(v.bloodGroup),
                nationality: blank(v.nationality),
                motherTongue: blank(v.motherTongue),
                academicYearId: cls.academicYearId,
                classId: cls.id,
                sectionId,
                rollNumber: blank(v.rollNumber),
                house: blank(v.house),
                stream: blank(v.stream),
                medium: blank(v.medium),
                admissionDate: optDate(v.admissionDate),
                admissionType: blank(v.admissionType),
                previousSchool: blank(v.previousSchool),
                previousClass: blank(v.previousClass),
                status: blank(v.status) ?? "active",
                address: blank(v.address),
                city: blank(v.city),
                district: blank(v.district),
                state: blank(v.state),
                country: blank(v.country),
                pinCode: blank(v.pinCode),
                primaryMobile: blank(v.primaryMobile),
                parentEmail: blank(v.parentEmail),
                emergencyName: blank(v.emergencyName),
                emergencyRelation: blank(v.emergencyRelation),
                emergencyContact: blank(v.emergencyContact),
                busNumber: blank(v.busNumber),
                route: blank(v.route),
                pickupPoint: blank(v.pickupPoint),
              };
              const saved = isUpdate
                ? await tx.student.update({ where: { id: existing }, data })
                : await tx.student.create({
                    data: {
                      schoolId,
                      ...data,
                      admissionNumber: data.admissionNumber!,
                      firstName: data.firstName!,
                      lastName: data.lastName!,
                    },
                  });
              ctx.students.set(key(saved.admissionNumber), saved.id);
              break;
            }

            case "guardians": {
              const studentId = ctx.students.get(key(v.admissionNumber))!;
              const guardianData = {
                fullName: v.fullName,
                firstName: v.fullName.split(" ")[0],
                lastName: v.fullName.split(" ").slice(1).join(" ") || null,
                mobile: blank(v.mobile) ?? null,
                alternateMobile: blank(v.alternateMobile) ?? null,
                email: blank(v.email) ?? null,
                occupation: blank(v.occupation) ?? null,
                organization: blank(v.organization) ?? null,
                education: blank(v.education) ?? null,
                address: blank(v.address) ?? null,
              };

              // A guardian is identified by who they are to this student, so
              // re-importing updates the same person rather than adding a twin.
              const linkKey = `${studentId}|${key(v.relationship)}|${key(v.fullName)}`;
              const linkId = ctx.guardianLinks.get(linkKey);
              const link = linkId
                ? await tx.studentGuardian.findUnique({ where: { id: linkId }, select: { id: true, guardianId: true } })
                : null;

              const linkFlags = {
                relationship: v.relationship,
                isPrimary: yes(v.isPrimary) ?? false,
                isEmergencyContact: yes(v.isEmergencyContact) ?? false,
                isAuthorizedPickup: yes(v.isAuthorizedPickup) ?? true,
                canReceiveFee: yes(v.canReceiveFee) ?? false,
              };

              if (link) {
                await tx.guardian.update({ where: { id: link.guardianId }, data: guardianData });
                await tx.studentGuardian.update({ where: { id: link.id }, data: linkFlags });
                sheetUpdated += 1;
                updated += 1;
              } else {
                const createdLink = await tx.studentGuardian.create({
                  data: {
                    ...linkFlags,
                    student: { connect: { id: studentId } },
                    guardian: { create: { schoolId, ...guardianData } },
                  },
                });
                ctx.guardianLinks.set(linkKey, createdLink.id);
                sheetCreated += 1;
                created += 1;
              }
              continue;
            }

            default:
              continue;
          }

          if (isUpdate) {
            sheetUpdated += 1;
            updated += 1;
          } else {
            sheetCreated += 1;
            created += 1;
          }
        }

        bySheet.push({ label: dataset.label, created: sheetCreated, updated: sheetUpdated });
      }

      return { created, updated, bySheet };
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}
