import type { Role } from "@/types/user";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

const SCHOOL_MODULES: PermissionModule[] = [
  "schoolProfile",
  "campuses",
  "academicYears",
  "classes",
  "sections",
  "subjects",
  "departments",
];

/** HR modules excluding salary — salary is granted separately and deliberately. */
const HR_PEOPLE_MODULES: PermissionModule[] = [
  "hrDashboard",
  "employees",
  "employeeDocuments",
  "designations",
  "employeeTypes",
  "employeeAttendance",
  "staffLeave",
  "holidays",
  "employeePerformance",
];

const RECRUITMENT_MODULES: PermissionModule[] = ["recruitment", "vacancies", "candidates", "interviews", "offers"];

/** Fees & Finance — Fee Structure: fee heads, fee-purpose student groupings, late-fee rules, and the structures themselves. */
const FEES_MODULES: PermissionModule[] = [
  "feeCategories",
  "feeStudentCategories",
  "lateFeeRules",
  "feeStructures",
  "studentFees",
  "payments",
  "receipts",
  "expenses",
  "expenseCategories",
];

/** Everything an accountant needs to own Fees day-to-day: create/edit/publish/archive fee structures, waive/adjust/transfer on a student account — but not delete a published structure outright. */
const FEES_ACTIONS: PermissionAction[] = ["view", "create", "edit", "export", "activate", "deactivate", "transfer"];

/** Student records, their guardians, parent-submitted admission forms, admission enquiries, and attendance. */
const STUDENT_MODULES: PermissionModule[] = [
  "students",
  "guardians",
  "studentRegistrations",
  "admissionEnquiries",
  "studentAttendance",
];

/**
 * ID cards sit with the office rather than with HR or academics — the same
 * people who print cards for students also print them for staff.
 */
const ID_CARD_MODULES: PermissionModule[] = ["idCards"];

/** Certificate types/numbering (configuration) and certificates themselves (generation/records). */
const CERTIFICATE_MODULES: PermissionModule[] = ["certificateTypes", "certificates"];

/**
 * Library — catalogue/settings routes exist today (Phase 1+2 of
 * LIBRARY-ROADMAP.md); the rest of these keys are declared now so the matrix
 * is complete and later phases don't need to reshape it, same precedent
 * CERTIFICATE_MODULES followed.
 */
const LIBRARY_MODULES: PermissionModule[] = [
  "libraryCatalogue",
  "libraryCirculation",
  "libraryReservations",
  "libraryFines",
  "libraryMembers",
  "libraryAcquisition",
  "libraryDigitalResources",
  "libraryInventory",
  "librarySettings",
];

/**
 * Transport — fleet vehicles have real routes today (Phase 1 of
 * TRANSPORT-ROADMAP.md); the rest of these keys are declared now so the
 * matrix is complete and later phases don't need to reshape it, same
 * precedent LIBRARY_MODULES followed.
 */
const TRANSPORT_MODULES: PermissionModule[] = [
  "transportVehicles",
  "transportDrivers",
  "transportRoutes",
  "transportStops",
  "transportStudents",
  "transportAttendance",
  "transportSettings",
];

/**
 * Examinations — Exam Types and Exam Creation have real routes today (Phase 1
 * of EXAM-ROADMAP.md); the rest of these keys are declared now so the matrix
 * is complete and later phases don't need to reshape it, same precedent
 * LIBRARY_MODULES/TRANSPORT_MODULES followed.
 */
const EXAM_MODULES: PermissionModule[] = [
  "examTypes",
  "exams",
  "examSchedule",
  "examMarks",
  "examVerification",
  "examResults",
  "examReportCards",
  "gradingSystem",
];

/**
 * AI module — see AI-ROADMAP.md. Only `aiAssistant` has real routes today;
 * the rest are forward-declared ahead of their phases, same precedent
 * LIBRARY_MODULES/TRANSPORT_MODULES/EXAM_MODULES followed.
 */
const AI_MODULES: PermissionModule[] = ["aiAssistant", "aiAnalytics", "aiReports", "aiCommunication", "aiDocuments"];

/** WhatsApp Communication & Bulk Messaging — see WHATSAPP-ROADMAP.md. */
const WHATSAPP_MODULES: PermissionModule[] = [
  "whatsappAccount",
  "whatsappContacts",
  "whatsappTemplates",
  "whatsappCampaigns",
];

/** Gmail Email Campaigns — see EMAIL-ROADMAP.md. */
const EMAIL_MODULES: PermissionModule[] = ["gmailConnection", "emailTemplates", "emailCampaigns"];

export const ALL_MODULES: PermissionModule[] = [
  "database",
  "timetable",
  ...SCHOOL_MODULES,
  ...STUDENT_MODULES,
  ...ID_CARD_MODULES,
  ...CERTIFICATE_MODULES,
  ...HR_PEOPLE_MODULES,
  ...RECRUITMENT_MODULES,
  "employeeSalary",
  ...FEES_MODULES,
  ...LIBRARY_MODULES,
  ...TRANSPORT_MODULES,
  ...EXAM_MODULES,
  ...AI_MODULES,
  ...WHATSAPP_MODULES,
  ...EMAIL_MODULES,
  "payroll",
];

/** Everything HR/Accounts needs to configure and run payroll day-to-day; locking a period is its own explicit step in the route, gated by the same `approve` grant. */
const PAYROLL_ACTIONS: PermissionAction[] = ["view", "create", "edit", "export", "approve"];

const EVERY_ACTION: PermissionAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "import",
  "activate",
  "deactivate",
  "approve",
  "transfer",
  "verify",
  "screen",
  "evaluate",
  "select",
  "convert",
  "promote",
];

const VIEW_EXPORT_EDIT: PermissionAction[] = ["view", "create", "edit", "export", "activate", "deactivate"];
const VIEW_EXPORT: PermissionAction[] = ["view", "export"];
const VIEW_ONLY: PermissionAction[] = ["view"];

function grant(
  modules: PermissionModule[],
  actions: PermissionAction[],
): Partial<Record<PermissionModule, PermissionAction[]>> {
  return Object.fromEntries(modules.map((m) => [m, actions]));
}

/**
 * Role → permission matrix for School Management + HR + Recruitment.
 *
 * This is the single source of truth for authorization. It is enforced
 * server-side by `requirePermission()` (src/lib/authorize.ts) on every mutating
 * HR route, and reused client-side by `useCan()` to hide controls the user
 * cannot use. Hiding alone is never the control — the server check is.
 *
 * Deliberate separations:
 * - `employeeSalary` (bank/PAN/salary) is granted only to HR Admin, School
 *   Admin, Super Admin and Accountant — not to Principal, HR Staff or HOD.
 * - `database` (whole-database export/import) is School Admin and Super Admin
 *   only. It crosses every module at once, so it is not implied by holding
 *   export rights on the individual ones.
 * - `expenses:create` (raise and submit) is granted far more widely than
 *   `expenses:approve` (sign off). That split is the whole point of the
 *   approval workflow, and self-approval is blocked in code besides.
 * - `receipts` never carries `edit` or `delete` for anyone, including Super
 *   Admin: the matrix cannot grant what no route implements. Correcting a
 *   receipt means cancelling its payment (`payments:delete`), which voids the
 *   receipt and leaves it on the record.
 * - Recruitment roles get no payroll access (spec §3.18).
 * - `teacher` holds no HR-wide grants; employees reach their own record through
 *   Employee Self-Service, which scopes by staff id rather than by role.
 */
/** Receipts are issue-and-read only — see the note above. */
const RECEIPT_ACTIONS: PermissionAction[] = ["view", "export"];

export const ROLE_PERMISSIONS: Record<Role, Partial<Record<PermissionModule, PermissionAction[]>>> = {
  super_admin: { ...grant(ALL_MODULES, EVERY_ACTION), receipts: RECEIPT_ACTIONS },
  school_admin: { ...grant(ALL_MODULES, EVERY_ACTION), receipts: RECEIPT_ACTIONS },

  // HR Admin — full HR management, including sensitive pay data. Student records
  // are not HR's to edit, so they get read access only.
  hr: {
    ...grant(SCHOOL_MODULES, VIEW_EXPORT),
    ...grant(STUDENT_MODULES, VIEW_EXPORT),
    ...grant(ID_CARD_MODULES, EVERY_ACTION),
    // Staff certificates (experience, employment, relieving letters...) are HR's to issue.
    ...grant(CERTIFICATE_MODULES, ["view", "create", "export"]),
    ...grant(HR_PEOPLE_MODULES, EVERY_ACTION),
    ...grant(RECRUITMENT_MODULES, EVERY_ACTION),
    employeeSalary: ["view", "create", "edit", "export"],
    // Configures pay structures/rules and can both process and approve a
    // payroll run — HR already holds "full HR management including sensitive
    // pay data" per this role's own doc comment above.
    payroll: PAYROLL_ACTIONS,
  },

  // HR Staff — day-to-day HR operations, but cannot see pay data, delete
  // employees, or convert a candidate into an employee.
  hr_staff: {
    ...grant(SCHOOL_MODULES, VIEW_ONLY),
    ...grant(STUDENT_MODULES, VIEW_ONLY),
    ...grant(ID_CARD_MODULES, ["view", "create", "edit", "export"]),
    // Day-to-day staff certificate issuing (experience letters, etc.) — same tier as ID cards.
    ...grant(CERTIFICATE_MODULES, ["view", "create", "export"]),
    ...grant(HR_PEOPLE_MODULES, ["view", "create", "edit", "export", "verify"]),
    ...grant(RECRUITMENT_MODULES, ["view", "create", "edit", "export", "screen", "evaluate"]),
  },

  // Principal — oversight across students, employees and hiring; no pay data.
  // Can approve parent-submitted admissions but not bulk-import or delete.
  principal: {
    // Oversight role: signs off what others raise, and can raise none of it
    // themselves without someone else approving (self-approval is blocked).
    expenses: ["view", "create", "edit", "export", "approve"],
    expenseCategories: ["view"],
    ...grant(SCHOOL_MODULES, VIEW_EXPORT_EDIT),
    ...grant(STUDENT_MODULES, ["view", "create", "edit", "export", "approve", "verify", "convert", "promote"]),
    ...grant(ID_CARD_MODULES, VIEW_EXPORT),
    // Approves, issues, and can revoke student certificates — the sign-off role for TC/Migration/Character.
    ...grant(CERTIFICATE_MODULES, ["view", "create", "export", "approve", "delete"]),
    ...grant(HR_PEOPLE_MODULES, ["view", "export", "approve"]),
    ...grant(RECRUITMENT_MODULES, ["view", "export", "evaluate", "select", "approve"]),
    ...grant(LIBRARY_MODULES, VIEW_EXPORT),
    ...grant(TRANSPORT_MODULES, VIEW_EXPORT),
    // Exam setup is an academic-configuration activity, the same tier as
    // Classes/Subjects — `approve` on examResults and `verify` on
    // examVerification are the natural additions once those phases ship
    // (EXAM-ROADMAP.md §3), the exam-controller/sign-off role the brief
    // describes.
    ...grant(["examTypes", "exams"], VIEW_EXPORT_EDIT),
    // Sets up rooms/timing sets and generates the school's timetable; `approve`
    // is publishing a draft timetable.
    timetable: ["view", "create", "edit", "export", "approve"],
    // School-wide assistant/analytics/reports; document upload stays with
    // School Admin/Super Admin only (AI-ROADMAP.md §4).
    aiAssistant: ["view", "create", "delete", "export"],
    aiAnalytics: ["view", "export"],
    aiReports: ["view", "create", "export"],
    aiCommunication: ["view", "create"],
    // Oversight sign-off on a payroll run — same "approve what someone else
    // processed" separation expenses/certificates already use for this role.
    payroll: ["view", "export", "approve"],
    // Can see the connection is healthy but not manage the integration itself
    // — same "setup stays with School Admin" split aiDocuments uses.
    whatsappAccount: ["view"],
    // Builds/maintains the address book; import stays narrower (bulk-import
    // is not granted to principal for students either — see STUDENT_MODULES).
    whatsappContacts: ["view", "create", "edit", "export"],
    whatsappTemplates: ["view", "create", "edit", "delete"],
    // Drafts, sends, and can cancel/retry any campaign school-wide.
    whatsappCampaigns: ["view", "create", "edit", "delete"],
    // Same setup-stays-with-School-Admin split as whatsappAccount.
    gmailConnection: ["view"],
    emailTemplates: ["view", "create", "edit", "delete"],
    emailCampaigns: ["view", "create", "edit", "delete"],
  },

  // HOD — manages their own department's staff. Row-level scoping to that
  // department is applied in the route on top of this grant.
  hod: {
    // A department head raises spends for their own department and sends them
    // up; approving is not theirs.
    expenses: ["view", "create", "edit", "export"],
    ...grant(["departments", "classes", "sections", "subjects"], VIEW_ONLY),
    ...grant(["examTypes", "exams"], VIEW_ONLY),
    timetable: ["view"],
    hrDashboard: ["view"],
    employees: ["view", "export"],
    employeeAttendance: ["view", "export", "approve"],
    staffLeave: ["view", "export", "approve"],
    holidays: ["view"],
    employeePerformance: ["view", "create", "edit", "evaluate"],
    interviews: ["view", "evaluate"],
    candidates: ["view"],
    vacancies: ["view"],
  },

  // Accountant — payroll-facing: pay data plus enough employee context to use it,
  // plus full day-to-day ownership of Fee Structure (not delete — see FEES_ACTIONS).
  accountant: {
    hrDashboard: ["view"],
    employees: ["view", "export"],
    employeeSalary: ["view", "export"],
    ...grant(FEES_MODULES, FEES_ACTIONS),
    // Cancelling a payment voids a receipt the family already holds, so it sits
    // with the office rather than with whoever took the money.
    payments: ["view", "create", "export"],
    receipts: RECEIPT_ACTIONS,
    // Records the spend and pays it once approved — but the approval itself is
    // someone else's, which is the separation the workflow exists for.
    expenses: ["view", "create", "edit", "export", "delete"],
    expenseCategories: ["view", "create", "edit"],
    // Processes payroll (configure structures, run a period, generate slips) —
    // approving/locking the run is HR's or Principal's, same create/approve
    // split as expenses above.
    payroll: ["view", "create", "edit", "export"],
    // Can word/adjust fee-reminder templates but not delete them — same tier
    // FEES_ACTIONS already draws for this role ("full day-to-day ownership,
    // not delete").
    whatsappTemplates: ["view", "create", "edit"],
    // Drafts and sends campaigns, but the route restricts audienceMode to
    // "fee_defaulters" only — this role's WhatsApp use is fee collection,
    // not general school communication.
    whatsappCampaigns: ["view", "create"],
    // Not in the spec's own accountant example, but the module's headline use
    // case is the fee reminder email — same fee_defaulters-only restriction
    // as whatsappCampaigns above (enforced in the route), same reasoning.
    emailTemplates: ["view", "create", "edit"],
    emailCampaigns: ["view", "create"],
  },

  // Teachers see the students they teach, but never edit the roster or the
  // guardian contact details behind it. Attendance is the one thing they can
  // write — and only for their own class-teacher section(s) and the specific
  // class/subject combinations they hold a SubjectAssignment for; that row-level
  // scoping is applied in the route (src/lib/teacher-scope.ts), not here.
  teacher: {
    ...grant(["classes", "sections", "subjects", "departments"], VIEW_EXPORT),
    students: ["view", "export"],
    studentAttendance: ["view", "create"],
    // Can request/generate a certificate for their own students; row-level
    // scoping to their own class(es) is still owed — see AUTH-RBAC-ROADMAP §5.
    // certificateTypes:view is needed too — generating requires browsing the
    // type/template list, even though teachers can't create or edit either.
    certificateTypes: ["view"],
    certificates: ["view", "create"],
    // Browse the catalogue and borrow for themselves; catalogue/settings edit
    // rights stay with the librarian. Circulation/reservations grants are
    // forward-declared ahead of those routes existing — see LIBRARY_MODULES.
    libraryCatalogue: ["view"],
    libraryCirculation: ["view", "create"],
    libraryReservations: ["view", "create"],
    // Needs to see what's scheduled and what's already been created; entering
    // marks (examMarks, scoped through src/lib/teacher-scope.ts) arrives with
    // EXAM-ROADMAP.md Phase 4.
    examTypes: ["view"],
    exams: ["view"],
    // Their own timetable — row-level scoping to their own staffId is applied
    // in the route (src/lib/teacher-scope.ts), same pattern as studentAttendance.
    timetable: ["view"],
    // Own conversations only, scoped in the route by userId. Tool answers are
    // scoped to their own classes once AI-ROADMAP.md Phase 5 tools land.
    aiAssistant: ["view", "create", "delete"],
    // Browse existing templates only — wording them is a school-level task.
    whatsappTemplates: ["view"],
    // Can draft and send a campaign, but the route restricts audienceMode to
    // "class_parents" and classId/sectionId to their own getTeacherScope()
    // homerooms — same row-level pattern studentAttendance/examMarks already
    // use on top of this coarse module grant. No whatsappContacts/whatsappAccount:
    // a teacher never touches the address book or the connection itself.
    whatsappCampaigns: ["view", "create"],
    // View-only, per spec — unlike WhatsApp, a teacher does not get email
    // campaign creation here (no row-scoped audience restriction to fall
    // back on for this channel; revisit if that's ever wanted).
    emailTemplates: ["view"],
  },
  // These three run budgets of their own — books, fuel, hostel supplies — so
  // they raise and submit expenses, and approve none. The librarian additionally
  // owns the library module end to end (LIBRARY-ROADMAP.md §3).
  // `subjects:view` lets the librarian tag a book with the subject it supports
  // when cataloguing — the catalogue form's classification field, not a grant
  // to manage subjects themselves.
  librarian: {
    ...grant(["departments"], VIEW_ONLY),
    ...grant(LIBRARY_MODULES, EVERY_ACTION),
    subjects: ["view"],
    expenses: ["view", "create", "edit"],
  },
  transport_manager: {
    ...grant(["departments"], VIEW_ONLY),
    ...grant(TRANSPORT_MODULES, EVERY_ACTION),
    expenses: ["view", "create", "edit"],
  },
  hostel_manager: { ...grant(["departments"], VIEW_ONLY), expenses: ["view", "create", "edit"] },
  // Parent/student — the portal. Row-level scoping to only their own linked
  // child (parent) or their own record (student) is applied in the route via
  // src/lib/portal-scope.ts, same pattern teacher/hod use their own scope
  // helpers on top of these role-level grants.
  parent: {
    studentAttendance: ["view"],
    timetable: ["view"],
    studentFees: ["view"],
    certificates: ["view"],
    transportStudents: ["view"],
  },
  student: {
    studentAttendance: ["view"],
    timetable: ["view"],
    certificates: ["view"],
    transportStudents: ["view"],
  },
};

export function hasPermission(role: Role, module: PermissionModule, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}

/** True if the role can see salary/bank/PAN fields — the one check worth naming. */
export function canViewSensitivePay(role: Role): boolean {
  return hasPermission(role, "employeeSalary", "view");
}
