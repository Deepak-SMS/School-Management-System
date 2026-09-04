import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { RequestUser } from "@/lib/current-user";
import { canViewSensitivePay } from "@/config/permissions";
import {
  ACADEMIC_YEAR_STATUSES,
  ACTIVE_STATUSES,
  CAMPUS_TYPES,
  DEPARTMENT_TYPES,
  SUBJECT_NATURE_TYPES,
  SUBJECT_TYPES,
} from "@/lib/constants/school";
import { BLOOD_GROUPS, GENDERS, STAFF_CATEGORIES, STUDENT_STATUSES } from "@/lib/constants/people";
import { EMPLOYMENT_STATUSES, MARITAL_STATUSES } from "@/lib/constants/hr";
import { ADMISSION_TYPES } from "@/lib/constants/student-documents";

/**
 * The one definition of what the school's database looks like as a spreadsheet.
 *
 * Export, the blank template, and import all read this registry — so a column
 * added here appears in the workbook, in the template, and in what the importer
 * accepts, in the same change. That is what stops the three drifting apart as
 * modules grow.
 *
 * Rows are flat strings on purpose. A spreadsheet has no notion of a foreign
 * key, so every reference is written as the thing a person would recognise —
 * a class is "Class 8", not a cuid — and `resolve` on the way back in turns
 * that name into an id. Ids never appear in the workbook at all: they would
 * make the file unreadable and unwriteable by the office staff who use it.
 */

export interface DatasetColumn {
  /** Header text as it appears in the sheet. */
  header: string;
  /** Key on the flat row object. */
  field: string;
  required?: boolean;
  /** Shown in the template's example row. */
  example: string;
  /** Allowed values, when the field is an enum. */
  allowed?: readonly string[];
  hint?: string;
  /**
   * Bank, PAN and statutory ids. Blanked on export for anyone without
   * `employeeSalary:view`, exactly as the per-record APIs do.
   */
  sensitive?: boolean;
}

export type DatasetRow = Record<string, string>;

export interface Dataset {
  key: string;
  /** Sheet name. Excel caps these at 31 characters and forbids : \ / ? * [ ]. */
  label: string;
  description: string;
  columns: DatasetColumn[];
  /** False for sheets that are a read-only picture of derived state. */
  importable: boolean;
  count(schoolId: string): Promise<number>;
  load(schoolId: string): Promise<DatasetRow[]>;
}

const STATUS = ACTIVE_STATUSES;

function date(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function num(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function bool(value: boolean | null | undefined): string {
  return value ? "yes" : "no";
}

function text(value: string | null | undefined): string {
  return value ?? "";
}

type StudentWithRelations = Prisma.StudentGetPayload<{ include: { class: true; section: true; academicYear: true } }>;

/**
 * Shared by the whole-database export (below) and the class/section-scoped
 * export on the Student Accounts page (src/app/api/students/accounts/export)
 * — one row shape however the query that produced it was filtered.
 */
export function shapeStudentRow(s: StudentWithRelations): DatasetRow {
  return {
    admissionNumber: s.admissionNumber,
    enrollmentNumber: text(s.enrollmentNumber),
    firstName: s.firstName,
    middleName: text(s.middleName),
    lastName: s.lastName,
    dateOfBirth: date(s.dateOfBirth),
    gender: text(s.gender),
    bloodGroup: text(s.bloodGroup),
    nationality: text(s.nationality),
    motherTongue: text(s.motherTongue),
    academicYear: s.academicYear.label,
    class: s.class.name,
    section: text(s.section?.name),
    rollNumber: text(s.rollNumber),
    house: text(s.house),
    stream: text(s.stream),
    medium: text(s.medium),
    admissionDate: date(s.admissionDate),
    admissionType: text(s.admissionType),
    previousSchool: text(s.previousSchool),
    previousClass: text(s.previousClass),
    status: s.status,
    address: text(s.address),
    city: text(s.city),
    district: text(s.district),
    state: text(s.state),
    country: text(s.country),
    pinCode: text(s.pinCode),
    primaryMobile: text(s.primaryMobile),
    parentEmail: text(s.parentEmail),
    emergencyName: text(s.emergencyName),
    emergencyRelation: text(s.emergencyRelation),
    emergencyContact: text(s.emergencyContact),
    busNumber: text(s.busNumber),
    route: text(s.route),
    pickupPoint: text(s.pickupPoint),
  };
}

export const DATASETS: Dataset[] = [
  {
    key: "campuses",
    label: "Campuses",
    description: "Physical campuses the school runs.",
    importable: true,
    columns: [
      { header: "Name", field: "name", required: true, example: "Main Campus" },
      { header: "Code", field: "code", required: true, example: "MAIN", hint: "Unique within the school" },
      { header: "Type", field: "campusType", example: "main", allowed: CAMPUS_TYPES },
      { header: "Address", field: "address", example: "12 Nehru Road" },
      { header: "City", field: "city", example: "Pune" },
      { header: "State", field: "state", example: "Maharashtra" },
      { header: "Country", field: "country", example: "India" },
      { header: "PIN Code", field: "pinCode", example: "411001" },
      { header: "Phone", field: "phone", example: "+91 9812345678" },
      { header: "Email", field: "email", example: "main@school.example" },
      { header: "Website", field: "website", example: "https://school.example" },
      { header: "Student Capacity", field: "studentCapacity", example: "1200" },
      { header: "Staff Capacity", field: "staffCapacity", example: "80" },
      { header: "Status", field: "status", example: "active", allowed: STATUS },
    ],
    count: (schoolId) => prisma.campus.count({ where: { schoolId } }),
    async load(schoolId) {
      const rows = await prisma.campus.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
      return rows.map((c) => ({
        name: c.name,
        code: c.code,
        campusType: c.campusType,
        address: text(c.address),
        city: text(c.city),
        state: text(c.state),
        country: text(c.country),
        pinCode: text(c.pinCode),
        phone: text(c.phone),
        email: text(c.email),
        website: text(c.website),
        studentCapacity: num(c.studentCapacity),
        staffCapacity: num(c.staffCapacity),
        status: c.status,
      }));
    },
  },

  {
    key: "academicYears",
    label: "Academic Years",
    description: "Sessions students and classes belong to.",
    importable: true,
    columns: [
      { header: "Label", field: "label", required: true, example: "2026-27", hint: "Unique within the school" },
      { header: "Start Date", field: "startDate", required: true, example: "2026-04-01", hint: "YYYY-MM-DD" },
      { header: "End Date", field: "endDate", required: true, example: "2027-03-31", hint: "YYYY-MM-DD" },
      { header: "Admission Start", field: "admissionStartDate", example: "2026-01-01" },
      { header: "Admission End", field: "admissionEndDate", example: "2026-03-31" },
      { header: "Status", field: "status", example: "active", allowed: ACADEMIC_YEAR_STATUSES },
    ],
    count: (schoolId) => prisma.academicYear.count({ where: { schoolId } }),
    async load(schoolId) {
      const rows = await prisma.academicYear.findMany({ where: { schoolId }, orderBy: { startDate: "desc" } });
      return rows.map((y) => ({
        label: y.label,
        startDate: date(y.startDate),
        endDate: date(y.endDate),
        admissionStartDate: date(y.admissionStartDate),
        admissionEndDate: date(y.admissionEndDate),
        status: y.status,
      }));
    },
  },

  {
    key: "classes",
    label: "Classes",
    description: "Classes within an academic year and campus.",
    importable: true,
    columns: [
      { header: "Name", field: "name", required: true, example: "Class 8" },
      { header: "Code", field: "code", required: true, example: "C8" },
      { header: "Academic Year", field: "academicYear", required: true, example: "2026-27", hint: "Must already exist" },
      { header: "Campus", field: "campus", required: true, example: "Main Campus", hint: "Campus name" },
      { header: "Sort Order", field: "sortOrder", example: "8" },
      { header: "Capacity", field: "capacity", example: "120" },
      { header: "Class Teacher", field: "classTeacher", example: "EMP014", hint: "Employee ID" },
      { header: "Status", field: "status", example: "active", allowed: STATUS },
    ],
    count: (schoolId) => prisma.class.count({ where: { schoolId } }),
    async load(schoolId) {
      const rows = await prisma.class.findMany({
        where: { schoolId },
        include: { academicYear: true, campus: true, classTeacher: { select: { employeeId: true } } },
        orderBy: { sortOrder: "asc" },
      });
      return rows.map((c) => ({
        name: c.name,
        code: c.code,
        academicYear: c.academicYear.label,
        campus: c.campus.name,
        sortOrder: num(c.sortOrder),
        capacity: num(c.capacity),
        classTeacher: text(c.classTeacher?.employeeId),
        status: c.status,
      }));
    },
  },

  {
    key: "sections",
    label: "Sections",
    description: "Sections within a class.",
    importable: true,
    columns: [
      { header: "Name", field: "name", required: true, example: "A" },
      { header: "Code", field: "code", required: true, example: "C8A" },
      { header: "Class", field: "class", required: true, example: "Class 8", hint: "Class name" },
      { header: "Academic Year", field: "academicYear", required: true, example: "2026-27" },
      { header: "Room", field: "room", example: "R-201" },
      { header: "Capacity", field: "capacity", example: "40" },
      { header: "Class Teacher", field: "classTeacher", example: "EMP014", hint: "Employee ID" },
      { header: "Status", field: "status", example: "active", allowed: STATUS },
    ],
    count: (schoolId) => prisma.section.count({ where: { schoolId } }),
    async load(schoolId) {
      const rows = await prisma.section.findMany({
        where: { schoolId },
        include: { class: true, academicYear: true, classTeacher: { select: { employeeId: true } } },
        orderBy: [{ class: { sortOrder: "asc" } }, { name: "asc" }],
      });
      return rows.map((s) => ({
        name: s.name,
        code: s.code,
        class: s.class.name,
        academicYear: s.academicYear.label,
        room: text(s.room),
        capacity: num(s.capacity),
        classTeacher: text(s.classTeacher?.employeeId),
        status: s.status,
      }));
    },
  },

  {
    key: "subjects",
    label: "Subjects",
    description: "Subjects taught, independent of class.",
    importable: true,
    columns: [
      { header: "Name", field: "name", required: true, example: "Mathematics" },
      { header: "Code", field: "code", required: true, example: "MATH" },
      { header: "Type", field: "subjectType", example: "core", allowed: SUBJECT_TYPES },
      { header: "Nature", field: "natureType", example: "theory", allowed: SUBJECT_NATURE_TYPES },
      { header: "Description", field: "description", example: "Number theory and algebra" },
      { header: "Max Marks", field: "maxMarks", example: "100" },
      { header: "Passing Marks", field: "passingMarks", example: "35" },
      { header: "Credits", field: "credits", example: "4" },
      { header: "Status", field: "status", example: "active", allowed: STATUS },
    ],
    count: (schoolId) => prisma.subject.count({ where: { schoolId } }),
    async load(schoolId) {
      const rows = await prisma.subject.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
      return rows.map((s) => ({
        name: s.name,
        code: s.code,
        subjectType: s.subjectType,
        natureType: s.natureType,
        description: text(s.description),
        maxMarks: num(s.maxMarks),
        passingMarks: num(s.passingMarks),
        credits: num(s.credits),
        status: s.status,
      }));
    },
  },

  {
    key: "departments",
    label: "Departments",
    description: "Departments staff belong to.",
    importable: true,
    columns: [
      { header: "Name", field: "name", required: true, example: "Finance" },
      { header: "Code", field: "code", required: true, example: "FIN" },
      {
        header: "Type",
        field: "departmentType",
        example: "administrative",
        allowed: DEPARTMENT_TYPES,
      },
      { header: "Campus", field: "campus", example: "Main Campus" },
      { header: "Head", field: "head", example: "EMP003", hint: "Employee ID" },
      { header: "Description", field: "description", example: "Fees and accounts" },
      { header: "Email", field: "email", example: "finance@school.example" },
      { header: "Phone", field: "phone", example: "+91 9812345678" },
      { header: "Status", field: "status", example: "active", allowed: STATUS },
    ],
    count: (schoolId) => prisma.department.count({ where: { schoolId } }),
    async load(schoolId) {
      const rows = await prisma.department.findMany({
        where: { schoolId },
        include: { campus: true, head: { select: { employeeId: true } } },
        orderBy: { name: "asc" },
      });
      return rows.map((d) => ({
        name: d.name,
        code: d.code,
        departmentType: d.departmentType,
        campus: text(d.campus?.name),
        head: text(d.head?.employeeId),
        description: text(d.description),
        email: text(d.email),
        phone: text(d.phone),
        status: d.status,
      }));
    },
  },

  {
    key: "designations",
    label: "Designations",
    description: "Job titles, and where they sit in the hierarchy.",
    importable: true,
    columns: [
      { header: "Name", field: "name", required: true, example: "Senior Teacher" },
      { header: "Code", field: "code", required: true, example: "SRTCH" },
      { header: "Department", field: "department", example: "Academics", hint: "Department name" },
      { header: "Level", field: "level", example: "3", hint: "1 is most senior" },
      { header: "Description", field: "description", example: "Subject lead" },
      { header: "Status", field: "status", example: "active", allowed: STATUS },
    ],
    count: (schoolId) => prisma.designation.count({ where: { schoolId } }),
    async load(schoolId) {
      const rows = await prisma.designation.findMany({
        where: { schoolId },
        include: { department: true },
        orderBy: [{ level: "asc" }, { name: "asc" }],
      });
      return rows.map((d) => ({
        name: d.name,
        code: d.code,
        department: text(d.department?.name),
        level: num(d.level),
        description: text(d.description),
        status: d.status,
      }));
    },
  },

  {
    key: "employeeTypes",
    label: "Employee Types",
    description: "Employment categories — permanent, contract, and so on.",
    importable: true,
    columns: [
      { header: "Name", field: "name", required: true, example: "Permanent" },
      { header: "Code", field: "code", required: true, example: "PERM" },
      { header: "Paid", field: "isPaid", example: "yes", allowed: ["yes", "no"] },
      { header: "Sort Order", field: "sortOrder", example: "1" },
      { header: "Status", field: "status", example: "active", allowed: STATUS },
    ],
    count: (schoolId) => prisma.employeeType.count({ where: { schoolId } }),
    async load(schoolId) {
      const rows = await prisma.employeeType.findMany({ where: { schoolId }, orderBy: { sortOrder: "asc" } });
      return rows.map((t) => ({
        name: t.name,
        code: t.code,
        isPaid: bool(t.isPaid),
        sortOrder: num(t.sortOrder),
        status: t.status,
      }));
    },
  },

  {
    key: "employees",
    label: "Employees",
    description: "The employee master. Bank and statutory columns need salary access.",
    importable: true,
    columns: [
      { header: "Employee ID", field: "employeeId", required: true, example: "EMP021", hint: "Unique; the key on re-import" },
      { header: "Full Name", field: "fullName", required: true, example: "Anita Sharma" },
      { header: "First Name", field: "firstName", example: "Anita" },
      { header: "Middle Name", field: "middleName", example: "" },
      { header: "Last Name", field: "lastName", example: "Sharma" },
      { header: "Category", field: "category", required: true, example: "teacher", allowed: STAFF_CATEGORIES },
      { header: "Date of Birth", field: "dateOfBirth", example: "1990-06-14" },
      { header: "Gender", field: "gender", example: "female", allowed: GENDERS },
      { header: "Blood Group", field: "bloodGroup", example: "O+", allowed: BLOOD_GROUPS },
      { header: "Marital Status", field: "maritalStatus", example: "married", allowed: MARITAL_STATUSES },
      { header: "Mobile", field: "mobileNumber", required: true, example: "+91 9812345678" },
      { header: "Alternate Number", field: "alternateNumber", example: "" },
      { header: "Email", field: "email", example: "anita@example.com" },
      { header: "Official Email", field: "officialEmail", example: "anita@school.example" },
      { header: "Department", field: "department", example: "Academics", hint: "Department name" },
      { header: "Designation", field: "designation", example: "Senior Teacher" },
      { header: "Employee Type", field: "employeeType", example: "Permanent" },
      { header: "Campus", field: "campus", example: "Main Campus" },
      { header: "Reporting Manager", field: "reportingManager", example: "EMP003", hint: "Employee ID" },
      { header: "Joining Date", field: "joiningDate", example: "2026-06-01" },
      { header: "Confirmation Date", field: "confirmationDate", example: "2026-12-01" },
      { header: "Probation End", field: "probationEndDate", example: "2026-12-01" },
      {
        header: "Employment Status",
        field: "employmentStatus",
        example: "active",
        allowed: EMPLOYMENT_STATUSES,
      },
      { header: "Work Location", field: "workLocation", example: "Main Campus" },
      { header: "Address", field: "address", example: "7 Hill Road" },
      { header: "City", field: "city", example: "Pune" },
      { header: "State", field: "state", example: "Maharashtra" },
      { header: "Country", field: "country", example: "India" },
      { header: "PIN Code", field: "pinCode", example: "411001" },
      { header: "Emergency Name", field: "emergencyName", example: "Rakesh Sharma" },
      { header: "Emergency Relation", field: "emergencyRelation", example: "Spouse" },
      { header: "Emergency Contact", field: "emergencyContact", example: "+91 9877777777" },
      { header: "PAN Number", field: "panNumber", example: "ABCDE1234F", sensitive: true },
      { header: "Bank Name", field: "bankName", example: "State Bank", sensitive: true },
      { header: "Bank Account", field: "bankAccountNumber", example: "12345678901", sensitive: true },
      { header: "Bank IFSC", field: "bankIfsc", example: "SBIN0001234", sensitive: true },
      { header: "PF Number", field: "pfNumber", example: "PF12345", sensitive: true },
      { header: "ESIC Number", field: "esicNumber", example: "ESIC12345", sensitive: true },
    ],
    count: (schoolId) => prisma.staff.count({ where: { schoolId } }),
    async load(schoolId) {
      const rows = await prisma.staff.findMany({
        where: { schoolId },
        include: {
          department: true,
          designation: true,
          employeeTypeRef: true,
          campus: true,
          reportingManager: { select: { employeeId: true } },
        },
        orderBy: { employeeId: "asc" },
      });
      return rows.map((s) => ({
        employeeId: s.employeeId,
        fullName: s.fullName,
        firstName: text(s.firstName),
        middleName: text(s.middleName),
        lastName: text(s.lastName),
        category: s.category,
        dateOfBirth: date(s.dateOfBirth),
        gender: text(s.gender),
        bloodGroup: text(s.bloodGroup),
        maritalStatus: text(s.maritalStatus),
        mobileNumber: s.mobileNumber,
        alternateNumber: text(s.alternateNumber),
        email: text(s.email),
        officialEmail: text(s.officialEmail),
        department: text(s.department?.name),
        designation: text(s.designation?.name),
        employeeType: text(s.employeeTypeRef?.name),
        campus: text(s.campus?.name),
        reportingManager: text(s.reportingManager?.employeeId),
        joiningDate: date(s.joiningDate),
        confirmationDate: date(s.confirmationDate),
        probationEndDate: date(s.probationEndDate),
        employmentStatus: s.employmentStatus,
        workLocation: text(s.workLocation),
        address: text(s.address),
        city: text(s.city),
        state: text(s.state),
        country: text(s.country),
        pinCode: text(s.pinCode),
        emergencyName: text(s.emergencyName),
        emergencyRelation: text(s.emergencyRelation),
        emergencyContact: text(s.emergencyContact),
        panNumber: text(s.panNumber),
        bankName: text(s.bankName),
        bankAccountNumber: text(s.bankAccountNumber),
        bankIfsc: text(s.bankIfsc),
        pfNumber: text(s.pfNumber),
        esicNumber: text(s.esicNumber),
      }));
    },
  },

  {
    key: "students",
    label: "Students",
    description: "The student master, keyed by admission number.",
    importable: true,
    columns: [
      { header: "Admission Number", field: "admissionNumber", required: true, example: "ADM021", hint: "Unique; the key on re-import" },
      { header: "Enrollment Number", field: "enrollmentNumber", example: "EN2026021" },
      { header: "First Name", field: "firstName", required: true, example: "Ishaan" },
      { header: "Middle Name", field: "middleName", example: "Raj" },
      { header: "Last Name", field: "lastName", required: true, example: "Kapoor" },
      { header: "Date of Birth", field: "dateOfBirth", example: "2013-04-11" },
      { header: "Gender", field: "gender", example: "male", allowed: GENDERS },
      { header: "Blood Group", field: "bloodGroup", example: "B+", allowed: BLOOD_GROUPS },
      { header: "Nationality", field: "nationality", example: "Indian" },
      { header: "Mother Tongue", field: "motherTongue", example: "Hindi" },
      { header: "Academic Year", field: "academicYear", required: true, example: "2026-27" },
      { header: "Class", field: "class", required: true, example: "Class 8", hint: "Class name" },
      { header: "Section", field: "section", example: "A", hint: "Must belong to the class" },
      { header: "Roll Number", field: "rollNumber", example: "41" },
      { header: "House", field: "house", example: "Emerald" },
      { header: "Stream", field: "stream", example: "" },
      { header: "Medium", field: "medium", example: "English" },
      { header: "Admission Date", field: "admissionDate", example: "2026-06-01" },
      {
        header: "Admission Type",
        field: "admissionType",
        example: "new",
        allowed: ADMISSION_TYPES,
      },
      { header: "Previous School", field: "previousSchool", example: "Little Stars" },
      { header: "Previous Class", field: "previousClass", example: "Class 7" },
      {
        header: "Status",
        field: "status",
        example: "active",
        allowed: STUDENT_STATUSES,
      },
      { header: "Address", field: "address", example: "7 Hill Road" },
      { header: "City", field: "city", example: "Pune" },
      { header: "District", field: "district", example: "Pune" },
      { header: "State", field: "state", example: "Maharashtra" },
      { header: "Country", field: "country", example: "India" },
      { header: "PIN Code", field: "pinCode", example: "411001" },
      { header: "Primary Mobile", field: "primaryMobile", example: "+91 9866666666" },
      { header: "Parent Email", field: "parentEmail", example: "kapoor@example.com" },
      { header: "Emergency Name", field: "emergencyName", example: "Vijay Kapoor" },
      { header: "Emergency Relation", field: "emergencyRelation", example: "Uncle" },
      { header: "Emergency Contact", field: "emergencyContact", example: "+91 9877777777" },
      { header: "Bus Number", field: "busNumber", example: "B-12" },
      { header: "Route", field: "route", example: "Kothrud" },
      { header: "Pickup Point", field: "pickupPoint", example: "Karve Road" },
    ],
    count: (schoolId) => prisma.student.count({ where: { schoolId } }),
    async load(schoolId) {
      const rows = await prisma.student.findMany({
        where: { schoolId },
        include: { class: true, section: true, academicYear: true },
        orderBy: [{ class: { sortOrder: "asc" } }, { section: { name: "asc" } }, { admissionNumber: "asc" }],
      });
      return rows.map(shapeStudentRow);
    },
  },

  {
    key: "guardians",
    label: "Guardians",
    description: "Parents and guardians, one row per student-guardian pairing.",
    importable: true,
    columns: [
      { header: "Admission Number", field: "admissionNumber", required: true, example: "ADM021", hint: "The student this guardian belongs to" },
      {
        header: "Relationship",
        field: "relationship",
        required: true,
        example: "father",
        allowed: ["father", "mother", "guardian", "grandfather", "grandmother", "sibling", "other"],
      },
      { header: "Full Name", field: "fullName", required: true, example: "Arun Kapoor" },
      { header: "Mobile", field: "mobile", example: "+91 9866666666" },
      { header: "Alternate Mobile", field: "alternateMobile", example: "" },
      { header: "Email", field: "email", example: "arun@example.com" },
      { header: "Occupation", field: "occupation", example: "Doctor" },
      { header: "Employer", field: "organization", example: "City Hospital" },
      { header: "Qualification", field: "education", example: "MBBS" },
      { header: "Address", field: "address", example: "7 Hill Road" },
      { header: "Primary Contact", field: "isPrimary", example: "yes", allowed: ["yes", "no"] },
      { header: "Emergency Contact", field: "isEmergencyContact", example: "yes", allowed: ["yes", "no"] },
      { header: "Authorized Pickup", field: "isAuthorizedPickup", example: "yes", allowed: ["yes", "no"] },
      { header: "Fee Notices", field: "canReceiveFee", example: "yes", allowed: ["yes", "no"] },
    ],
    count: (schoolId) => prisma.studentGuardian.count({ where: { student: { schoolId } } }),
    async load(schoolId) {
      const rows = await prisma.studentGuardian.findMany({
        where: { student: { schoolId } },
        include: { student: { select: { admissionNumber: true } }, guardian: true },
        orderBy: [{ student: { admissionNumber: "asc" } }, { sortOrder: "asc" }],
      });
      return rows.map((g) => ({
        admissionNumber: g.student.admissionNumber,
        relationship: g.relationship,
        fullName: g.guardian.fullName,
        mobile: text(g.guardian.mobile),
        alternateMobile: text(g.guardian.alternateMobile),
        email: text(g.guardian.email),
        occupation: text(g.guardian.occupation),
        organization: text(g.guardian.organization),
        education: text(g.guardian.education),
        address: text(g.guardian.address),
        isPrimary: bool(g.isPrimary),
        isEmergencyContact: bool(g.isEmergencyContact),
        isAuthorizedPickup: bool(g.isAuthorizedPickup),
        canReceiveFee: bool(g.canReceiveFee),
      }));
    },
  },
];

export function getDataset(key: string): Dataset | undefined {
  return DATASETS.find((d) => d.key === key);
}

/**
 * Resolves the `datasets` query parameter. Omitted means everything — an export
 * called "export database" should default to the whole database.
 */
export function selectDatasets(param: string | null): Dataset[] {
  if (!param) return DATASETS;
  const wanted = new Set(param.split(",").map((k) => k.trim()).filter(Boolean));
  const chosen = DATASETS.filter((d) => wanted.has(d.key));
  return chosen.length > 0 ? chosen : DATASETS;
}

/**
 * Columns this user may see. Bank and statutory ids are dropped entirely rather
 * than blanked — a column of empty cells invites someone to fill it in and
 * re-import, which would look like a deliberate erasure.
 */
export function visibleColumns(dataset: Dataset, user: RequestUser): DatasetColumn[] {
  if (canViewSensitivePay(user.role)) return dataset.columns;
  return dataset.columns.filter((c) => !c.sensitive);
}
