/**
 * Permission vocabulary, expressed as `module × action`.
 *
 * The spec lists permissions as dotted strings (`employee.salary`,
 * `candidate.convert`). Those map onto this matrix rather than introducing a
 * second scheme — e.g. `employee.salary` is `employeeSalary:view`, and
 * `candidate.convert` is `candidates:convert`. Keeping one shape means the
 * School Management modules already using `hasPermission()` keep working.
 *
 * Salary/bank data sits in its own module (`employeeSalary`) precisely so it can
 * be granted separately from ordinary employee access, per spec §2.17.
 */
export type PermissionModule =
  // School Management (existing)
  | "schoolProfile"
  | "campuses"
  | "academicYears"
  | "classes"
  | "sections"
  | "subjects"
  | "departments"
  /**
   * Whole-database Excel export/import. Deliberately its own module: it reaches
   * across every other one at once, so holding it is a far bigger grant than
   * holding `students:export` and `employees:export` separately.
   */
  | "database"
  /** ID card generation, templates, and the card register. */
  | "idCards"
  /** Certificate types, numbering prefixes, and templates — the configuration
   *  layer behind certificate generation. */
  | "certificateTypes"
  /** Generating, viewing, downloading, and revoking certificates themselves. */
  | "certificates"
  // Students
  | "students"
  | "guardians"
  /** Parent-submitted admission forms awaiting review. */
  | "studentRegistrations"
  /** Pre-application leads (walk-in/phone/website) that generate an admission
   *  form link; a lighter-weight funnel that feeds StudentRegistration. */
  | "admissionEnquiries"
  /** Daily/homeroom and per-subject-period attendance. A teacher's grant here is
   *  always scoped in the route to the sections/subjects they actually teach —
   *  see src/lib/teacher-scope.ts. */
  | "studentAttendance"
  // HR — people
  | "hrDashboard"
  | "employees"
  | "employeeSalary"
  | "employeeDocuments"
  | "designations"
  | "employeeTypes"
  // HR — modules that arrive in later phases; listed now so the matrix is
  // complete and route guards don't need re-shaping when they land.
  | "employeeAttendance"
  /** Staff leave: types, balances, requests, and approving them. */
  | "staffLeave"
  /** The holiday and work calendar every attendance figure is measured against. */
  | "holidays"
  | "employeePerformance"
  // Recruitment
  | "recruitment"
  | "vacancies"
  | "candidates"
  | "interviews"
  | "offers"
  // Fees & Finance — Fee Structure
  /** Fee heads master (Tuition, Admission, Transport...). */
  | "feeCategories"
  /** Fee-purpose student groupings (General, RTE, Staff Ward...). */
  | "feeStudentCategories"
  | "lateFeeRules"
  /** The fee plans themselves — items, installments, publish/archive, and the students they auto-assign. */
  | "feeStructures"
  /** Each student's individual fee account — charges, waivers, discounts, corrections, and transfers. */
  | "studentFees"
  /** Recording money received, and cancelling a payment recorded in error. */
  | "payments"
  /**
   * Receipts. There is no `edit` or `delete` here on purpose — a receipt is an
   * official document, and the only change it ever accepts is being voided,
   * which is `payments:delete` (cancelling the payment behind it).
   */
  | "receipts"
  /** Recording school expenditure. `create` submits for approval; `approve` is
   *  deliberately separate so ordinary staff can raise a spend they cannot sign
   *  off — see src/lib/finance/expense-workflow.ts. */
  | "expenses"
  /** The heads of expenditure themselves — a settings-level concern. */
  | "expenseCategories"
  // Library — see LIBRARY-ROADMAP.md. Modules are listed in full now (matrix
  // completeness) even though only catalogue/settings routes exist so far;
  // the rest arrive phase by phase without reshaping this union.
  /** Book titles, categories, and physical copies (accession numbers, barcodes, shelf location). */
  | "libraryCatalogue"
  /** Issuing, returning, and renewing books. */
  | "libraryCirculation"
  | "libraryReservations"
  | "libraryFines"
  /** Library membership records linking a Student/Staff to borrowing privileges. */
  | "libraryMembers"
  /** Purchases, donations, and the vendors books are acquired from. */
  | "libraryAcquisition"
  | "libraryDigitalResources"
  /** Physical stock verification (found/missing/damaged reconciliation). */
  | "libraryInventory"
  /** Borrowing limits, fine rules, and library-wide configuration. */
  | "librarySettings"
  // Transport — see TRANSPORT-ROADMAP.md. Modules are listed in full now
  // (matrix completeness) even though only transportVehicles has real routes
  // so far; the rest arrive phase by phase without reshaping this union,
  // same precedent LIBRARY_MODULES followed.
  /** Fleet vehicles — registration, capacity, fuel type, status. Documents and maintenance history land in a later phase. */
  | "transportVehicles"
  | "transportDrivers"
  | "transportRoutes"
  | "transportStops"
  /** Which student rides which route/stop — supersedes the free-text Student.busNumber/route/pickupPoint fields. */
  | "transportStudents"
  | "transportAttendance"
  /** Per-route/per-distance fee rates and transport-wide configuration. */
  | "transportSettings"
  // Examinations — see EXAM-ROADMAP.md. Modules are listed in full now
  // (matrix completeness) even though only examTypes/exams have real routes
  // so far; the rest arrive phase by phase without reshaping this union,
  // same precedent LIBRARY_MODULES/TRANSPORT_MODULES followed.
  /** Exam type master — Unit Test, Quarterly, Half-Yearly, Annual... */
  | "examTypes"
  /** Exam Creation itself — dates, applicable classes/sections, result type. */
  | "exams"
  /** Per-exam, per-subject timetable: date, time, room, invigilator. */
  | "examSchedule"
  /** Entering student marks/grades against a scheduled exam subject. A
   *  teacher's grant here is scoped to the subjects they hold a
   *  SubjectAssignment for — see src/lib/teacher-scope.ts, same pattern
   *  studentAttendance already uses. */
  | "examMarks"
  /** Locking entered marks so nobody edits them after sign-off — the
   *  AttendancePeriodLock-shaped workflow for exams. */
  | "examVerification"
  /** Calculated totals, percentage, grade, rank, pass/fail — and publishing them. */
  | "examResults"
  /** Report card templates and generation. */
  | "examReportCards"
  /** Grade bands and the percentage ranges they map to. */
  | "gradingSystem"
  /** Timing sets/periods/rooms/teacher-availability setup, timetable creation,
   *  the automatic generator, and manual slot edits — see src/lib/timetable/.
   *  A teacher's `view` grant is scoped to their own timetable slots in the
   *  route, same pattern studentAttendance/examMarks already use. */
  | "timetable"
  // AI module — see AI-ROADMAP.md. All five keys are declared now (matrix
  // completeness, same precedent LIBRARY_MODULES/TRANSPORT_MODULES/EXAM_MODULES
  // followed) even though only aiAssistant has real routes so far.
  /** The AI School Assistant chat — conversations, messages, and (later) the
   *  ERP tools it calls. A teacher's grant is scoped to their own classes at
   *  the tool level once Phase 5 tools exist — see AI-ROADMAP.md §7. */
  | "aiAssistant"
  /** AI-narrated analytics dashboards (student/class/attendance/fee). No
   *  routes yet — arrives with AI-ROADMAP.md Phase 6. */
  | "aiAnalytics"
  /** AI-generated PDF/DOCX reports. No routes yet — Phase 7. */
  | "aiReports"
  /** AI-drafted parent/staff communications — draft only, sending is a
   *  separate, explicit user action. No routes yet — Phase 8. */
  | "aiCommunication"
  /** RAG document upload (school policies/handbooks). No routes yet —
   *  Phase 9. Deliberately its own module: uploading what the AI can read is a
   *  bigger grant than just using the assistant, same reasoning as `database`. */
  | "aiDocuments"
  // Payroll — see HR-PAYROLL-ROADMAP.md. Salary components/structures/rules
  // and payroll processing/slips have real routes today (Phase 2 + Phase 3 of
  // that roadmap); advances, reimbursements, overtime, shifts, assets,
  // performance, and exit/offboarding are later phases, not yet built.
  /** Salary components, structures, payroll rules (PF/ESI/PT/TDS), and
   *  running/approving/locking payroll periods + salary slips. */
  | "payroll"
  // WhatsApp Communication & Bulk Messaging — see WHATSAPP-ROADMAP.md.
  /** Connecting/disconnecting the school's WhatsApp number and viewing its
   *  live status — an integration-setup concern, kept separate from using
   *  WhatsApp to message people, same split `database`/`aiDocuments` use for
   *  "a bigger grant than the everyday module". */
  | "whatsappAccount"
  /** The WhatsApp address book — manual entries, Excel-imported contacts, and
   *  the opt-out state every campaign audience mode is checked against. */
  | "whatsappContacts"
  /** Reusable {{variable}} message templates. */
  | "whatsappTemplates"
  /** Drafting, sending, cancelling, retrying, and reviewing bulk WhatsApp
   *  sends. `create` covers both drafting a campaign and the explicitly
   *  confirmed send step — same one-permission-covers-both-steps precedent
   *  `aiCommunication` already uses (send is a UX safety gate, not a separate
   *  grant). Row-level restriction (a teacher's audience limited to their own
   *  class, an accountant's to fee-related audiences) is enforced in the
   *  route, not this matrix — same pattern studentAttendance/examMarks use. */
  | "whatsappCampaigns"
  // Gmail Email Campaigns — see EMAIL-ROADMAP.md.
  /** Connecting/disconnecting the school's Gmail account via Google OAuth and
   *  viewing its live status — kept separate from using it to send email,
   *  same split `whatsappAccount` uses. */
  | "gmailConnection"
  /** Reusable {{variable}} email templates (subject + HTML body). */
  | "emailTemplates"
  /** Drafting, sending, scheduling, cancelling, and retrying bulk email
   *  campaigns. `create` covers both drafting and the confirmed send step —
   *  same one-permission-covers-both-steps precedent `whatsappCampaigns`
   *  already uses. */
  | "emailCampaigns";

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "import"
  | "activate"
  | "deactivate"
  | "approve"
  | "transfer"
  | "verify"
  | "screen"
  | "evaluate"
  | "select"
  | "convert"
  /** Bulk year-rollover: move students into the next academic year's classes, or mark them retained/graduated. */
  | "promote";

/** A single permission as a readable string, used in error messages and audit entries. */
export function permissionKey(module: PermissionModule, action: PermissionAction): string {
  return `${module}:${action}`;
}
