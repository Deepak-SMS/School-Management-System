import {
  LayoutDashboard,
  School,
  UserPlus,
  Users,
  UserCog,
  BookOpenCheck,
  Wallet,
  MessagesSquare,
  IdCard,
  ScrollText,
  Library,
  Bus,
  BedDouble,
  Boxes,
  GraduationCap,
  BarChart3,
  Sparkles,
  Settings,
  ClipboardCheck,
  ClipboardList,
  CalendarClock,
  Newspaper,
} from "lucide-react";
import type { NavSection } from "@/types/navigation";
import type { Role } from "@/types/user";

/** Full admin-side navigation tree. Filtered per-role at render time. */
const adminNavigation: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    title: "School Management",
    icon: School,
    roles: ["super_admin", "school_admin", "principal"],
    items: [
      { label: "School Profile", href: "/school/profile" },
      { label: "Campuses", href: "/school/campuses" },
      { label: "Academic Years", href: "/school/academic-years" },
      { label: "Classes", href: "/school/classes" },
      { label: "Subjects", href: "/school/subjects" },
      { label: "Departments", href: "/school/departments" },
      { label: "Organization", href: "/school/organization" },
      { label: "Database", href: "/school/database", roles: ["super_admin", "school_admin"] },
    ],
  },
  /**
   * Examination — deliberately its own top-level section, not one more link
   * under Academics: it has the deepest sub-flow of anything in the sidebar
   * (creation → schedule → marks → verification → results → report cards),
   * per EXAM-ROADMAP.md §3. Placed directly below School Management since
   * exam setup builds on the Academic Year/Class/Section configuration there.
   * Only lists what's actually built (Phase 1) — Schedule/Marks/Verification/
   * Results/Report Cards/Grading System arrive as later phases ship.
   */
  {
    title: "Examination",
    icon: ClipboardList,
    roles: ["super_admin", "school_admin", "principal", "teacher", "hod"],
    items: [
      { label: "All Exams", href: "/exams" },
      { label: "Exam Types", href: "/exams/types", roles: ["super_admin", "school_admin", "principal"] },
    ],
  },
  {
    title: "Admissions",
    icon: UserPlus,
    roles: ["super_admin", "school_admin", "principal"],
    items: [
      { label: "Admission Enquiries", href: "/admissions/enquiries" },
      { label: "Applications", href: "/admissions/applications" },
      { label: "Admissions", href: "/admissions" },
      { label: "Admission Reports", href: "/admissions/reports" },
      { label: "Enrollment", href: "/admissions/enrollment" },
      { label: "Admission Documents", href: "/admissions/documents" },
    ],
  },
  {
    title: "Students",
    icon: Users,
    roles: ["super_admin", "school_admin", "principal", "teacher"],
    items: [
      { label: "All Students", href: "/students" },
      { label: "Student Groups", href: "/students/groups" },
      { label: "Student Accounts", href: "/students/accounts", roles: ["super_admin", "school_admin", "principal"] },
      { label: "Teacher Access", href: "/students/teacher-access", roles: ["super_admin", "school_admin", "principal"] },
      { label: "My Classes & Subjects", href: "/students/my-classes", roles: ["teacher"] },
      { label: "Student Documents", href: "/students/documents" },
      { label: "Student Promotion", href: "/students/promotion", roles: ["super_admin", "school_admin", "principal"] },
    ],
  },
  {
    title: "Parents",
    icon: Users,
    roles: ["super_admin", "school_admin", "principal"],
    items: [
      { label: "Parents / Guardians", href: "/parents" },
      { label: "Parent Accounts", href: "/parents/accounts" },
    ],
  },
  /**
   * HR & Payroll.
   *
   * One section rather than the three it used to be (HR Management /
   * Recruitment / HR & Payroll), because they are one employee lifecycle:
   * hire → onboard → attend → be paid → be appraised → leave. Items appear
   * here as they are actually built — a link to a page that doesn't exist is
   * worse than no link.
   */
  {
    title: "HR & Payroll",
    icon: UserCog,
    roles: ["super_admin", "school_admin", "principal", "hr", "hr_staff", "hod", "accountant"],
    items: [
      { label: "HR Dashboard", href: "/hr" },
      { label: "Employees", href: "/employees" },
      { label: "Teaching Staff", href: "/employees/teachers" },
      { label: "Departments", href: "/school/departments", roles: ["super_admin", "school_admin", "principal", "hr", "hr_staff"] },
      { label: "Designations", href: "/hr/designations", roles: ["super_admin", "school_admin", "principal", "hr", "hr_staff"] },
      { label: "Employee Types", href: "/hr/employee-types", roles: ["super_admin", "school_admin", "hr", "hr_staff"] },
      { label: "Holiday & Work Calendar", href: "/hr/calendar", roles: ["super_admin", "school_admin", "principal", "hr", "hr_staff"] },
      { label: "Employee Attendance", href: "/hr/attendance" },
      { label: "Leave Management", href: "/hr/leave" },
      // Payroll — see HR-PAYROLL-ROADMAP.md Phase 2 (components/structures/
      // rules) + Phase 3 (periods/slips), both shipped in this pass. Visible
      // only to roles actually granted the `payroll` permission.
      { label: "Payroll", href: "/hr/payroll", roles: ["super_admin", "school_admin", "principal", "hr", "accountant"] },
      { label: "Salary Slips", href: "/hr/salary-slips", roles: ["super_admin", "school_admin", "principal", "hr", "accountant"] },
    ],
  },
  {
    title: "Recruitment",
    icon: UserPlus,
    roles: ["super_admin", "school_admin", "principal", "hr", "hr_staff"],
    items: [
      { label: "Recruitment Dashboard", href: "/hr/recruitment" },
      { label: "Vacancies", href: "/hr/vacancies" },
      { label: "Candidates", href: "/hr/candidates" },
      { label: "Interviews", href: "/hr/interviews" },
      { label: "Offers", href: "/hr/offers" },
    ],
  },
  /**
   * Attendance — its own top-level section per ATTENDANCE-ROADMAP.md §4,
   * mirroring how Examination got pulled out of Academics rather than staying
   * a nested link. Dashboard is open to teachers too (same figures the general
   * `/admin` Dashboard already shows them); the admin-facing "browse any
   * class and mark" screen is not — a teacher's equivalent is "My Classes &
   * Subjects" (Students section), scoped to getTeacherScope().
   */
  {
    title: "Attendance",
    icon: ClipboardCheck,
    roles: ["super_admin", "school_admin", "principal", "teacher"],
    items: [
      { label: "Dashboard", href: "/academics/attendance" },
      {
        label: "Mark Attendance",
        href: "/academics/attendance/mark",
        roles: ["super_admin", "school_admin", "principal"],
      },
      { label: "Student Calendar", href: "/academics/attendance/calendar" },
      {
        label: "Class Report",
        href: "/academics/attendance/reports",
        roles: ["super_admin", "school_admin", "principal"],
      },
      {
        label: "Defaulters",
        href: "/academics/attendance/defaulters",
        roles: ["super_admin", "school_admin", "principal"],
      },
      {
        label: "Settings",
        href: "/academics/attendance/settings",
        roles: ["super_admin", "school_admin", "principal"],
      },
    ],
  },
  {
    title: "Academics",
    icon: BookOpenCheck,
    roles: ["super_admin", "school_admin", "principal", "teacher"],
    items: [
      { label: "Subjects", href: "/academics/subjects" },
      { label: "Timetable", href: "/academics/timetable", icon: CalendarClock },
      { label: "Assignments", href: "/academics/assignments" },
      { label: "Homework", href: "/academics/homework" },
    ],
  },
  {
    title: "News Management",
    icon: Newspaper,
    roles: ["super_admin", "school_admin", "principal", "teacher"],
    items: [
      { label: "Dashboard", href: "/news" },
      { label: "All News", href: "/news/all" },
      { label: "Create News", href: "/news/new" },
      { label: "Categories", href: "/news/categories" },
      { label: "Comments & Moderation", href: "/news/comments" },
    ],
  },
  {
    title: "Fees & Finance",
    icon: Wallet,
    roles: ["super_admin", "school_admin", "accountant"],
    items: [
      { label: "Fee Structure", href: "/fees/structure" },
      { label: "Student Fees", href: "/fees/student-fees" },
      { label: "Invoices", href: "/fees/invoices" },
      { label: "Payments", href: "/fees/payments" },
      { label: "Receipts", href: "/fees/receipts" },
      { label: "Discounts", href: "/fees/discounts" },
      { label: "Scholarships", href: "/fees/scholarships" },
      { label: "Expenses", href: "/finance/expenses" },
      { label: "Finance Reports", href: "/finance/reports" },
    ],
  },
  {
    title: "Communication",
    icon: MessagesSquare,
    roles: ["super_admin", "school_admin", "principal", "teacher", "accountant"],
    items: [
      { label: "Notifications", href: "/communication/notifications" },
      { label: "SMS", href: "/communication/sms", roles: ["super_admin", "school_admin", "principal", "accountant"] },
      { label: "Email", href: "/communication/email", roles: ["super_admin", "school_admin", "principal", "accountant"] },
      { label: "Email Templates", href: "/communication/email/templates", roles: ["super_admin", "school_admin", "principal", "accountant"] },
      { label: "Email Campaigns", href: "/communication/email/campaigns", roles: ["super_admin", "school_admin", "principal", "accountant"] },
      { label: "Email Settings", href: "/communication/email/settings", roles: ["super_admin", "school_admin", "principal"] },
      { label: "WhatsApp", href: "/communication/whatsapp", roles: ["super_admin", "school_admin", "principal", "accountant"] },
      { label: "WhatsApp Contacts", href: "/communication/whatsapp/contacts", roles: ["super_admin", "school_admin", "principal"] },
      { label: "WhatsApp Templates", href: "/communication/whatsapp/templates", roles: ["super_admin", "school_admin", "principal", "accountant"] },
      { label: "WhatsApp Campaigns", href: "/communication/whatsapp/campaigns", roles: ["super_admin", "school_admin", "principal", "accountant"] },
      { label: "WhatsApp Inbox", href: "/communication/whatsapp/inbox", roles: ["super_admin", "school_admin", "principal"] },
      { label: "WhatsApp History", href: "/communication/whatsapp/history", roles: ["super_admin", "school_admin", "principal", "accountant"] },
      { label: "Push Notifications", href: "/communication/push" },
      { label: "Internal Messages", href: "/communication/messages" },
      { label: "Announcements", href: "/communication/announcements", roles: ["super_admin", "school_admin", "principal", "accountant"] },
    ],
  },
  {
    title: "Generate ID Card",
    icon: IdCard,
    roles: ["super_admin", "school_admin", "principal"],
    items: [
      { label: "Dashboard", href: "/id-cards" },
      // Templates folded into the Designer — choosing a design and editing it
      // are the same task, so they're no longer two destinations.
      { label: "Designer", href: "/id-cards/designer" },
      { label: "Generate Cards", href: "/id-cards/generate" },
      { label: "Generated Cards", href: "/id-cards/generated" },
      { label: "Verification", href: "/id-cards/verification" },
      { label: "Card Management", href: "/id-cards/management" },
    ],
  },
  {
    title: "Certificate Management",
    icon: ScrollText,
    roles: ["super_admin", "school_admin", "principal", "hr", "hr_staff"],
    items: [
      { label: "Dashboard", href: "/certificates" },
      { label: "Certificate Types", href: "/certificates/types", roles: ["super_admin", "school_admin", "principal"] },
      { label: "Designer", href: "/certificates/designer", roles: ["super_admin", "school_admin", "principal"] },
      { label: "Generate Certificate", href: "/certificates/generate" },
      { label: "Generated Certificates", href: "/certificates/generated" },
    ],
  },
  {
    title: "Library",
    icon: Library,
    roles: ["super_admin", "school_admin", "principal", "librarian"],
    items: [
      { label: "Dashboard", href: "/library" },
      { label: "Catalogue", href: "/library/catalogue" },
      { label: "Settings", href: "/library/settings", roles: ["super_admin", "school_admin", "librarian"] },
    ],
  },
  {
    title: "Transport",
    icon: Bus,
    roles: ["super_admin", "school_admin", "transport_manager"],
    items: [
      { label: "Vehicles", href: "/transport/vehicles" },
      { label: "Routes", href: "/transport/routes" },
      { label: "Stops", href: "/transport/stops" },
      { label: "Drivers", href: "/transport/drivers" },
      { label: "Student Transport", href: "/transport/students" },
    ],
  },
  {
    title: "Hostel",
    icon: BedDouble,
    roles: ["super_admin", "school_admin", "hostel_manager"],
    items: [
      { label: "Hostels", href: "/hostel" },
      { label: "Rooms", href: "/hostel/rooms" },
      { label: "Beds", href: "/hostel/beds" },
      { label: "Allocations", href: "/hostel/allocations" },
      { label: "Hostel Fees", href: "/hostel/fees" },
    ],
  },
  {
    title: "Inventory",
    icon: Boxes,
    roles: ["super_admin", "school_admin"],
    items: [
      { label: "Items", href: "/inventory/items" },
      { label: "Categories", href: "/inventory/categories" },
      { label: "Suppliers", href: "/inventory/suppliers" },
      { label: "Stock", href: "/inventory/stock" },
      { label: "Purchase", href: "/inventory/purchase" },
      { label: "Issue", href: "/inventory/issue" },
    ],
  },
  {
    title: "LMS",
    icon: GraduationCap,
    roles: ["super_admin", "school_admin", "principal", "teacher"],
    items: [
      { label: "Courses", href: "/lms/courses" },
      { label: "Lessons", href: "/lms/lessons" },
      { label: "Assignments", href: "/lms/assignments" },
      { label: "Quizzes", href: "/lms/quizzes" },
      { label: "Learning Materials", href: "/lms/materials" },
    ],
  },
  {
    title: "Reports & Analytics",
    icon: BarChart3,
    roles: ["super_admin", "school_admin", "principal", "accountant", "hr"],
    items: [
      { label: "Dashboard", href: "/reports" },
      { label: "Student Reports", href: "/reports/students" },
      { label: "Attendance Reports", href: "/reports/attendance" },
      { label: "Academic Reports", href: "/reports/academics" },
      { label: "Examination Reports", href: "/reports/examinations" },
      { label: "Fee Reports", href: "/reports/fees" },
      { label: "Finance Reports", href: "/reports/finance" },
      { label: "HR Reports", href: "/reports/hr" },
      { label: "Custom Reports", href: "/reports/custom" },
    ],
  },
  {
    title: "AI",
    icon: Sparkles,
    roles: ["super_admin", "school_admin", "principal", "teacher"],
    items: [
      { label: "AI School Assistant", href: "/ai/assistant" },
      { label: "AI Analytics", href: "/ai/analytics", roles: ["super_admin", "school_admin", "principal"] },
      {
        label: "AI Report Generator",
        href: "/ai/report-generator",
        roles: ["super_admin", "school_admin", "principal"],
      },
      {
        label: "AI Communication Assistant",
        href: "/ai/communication-assistant",
        roles: ["super_admin", "school_admin", "principal"],
      },
    ],
  },
  {
    title: "System",
    icon: Settings,
    roles: ["super_admin", "school_admin"],
    items: [
      { label: "Settings", href: "/settings" },
      { label: "Users", href: "/settings/users" },
      { label: "Roles & Permissions", href: "/settings/roles" },
      { label: "Integrations", href: "/settings/integrations" },
      { label: "Audit Logs", href: "/settings/audit-logs" },
      { label: "Subscription", href: "/settings/subscription" },
      { label: "Billing", href: "/settings/billing" },
    ],
  },
];

/**
 * Separate, deliberately short IA for the parent/student portal (section 27).
 *
 * Only lists what's actually built (PARENT-STUDENT-PORTAL-ROADMAP.md Phase C)
 * — Results, Assignments, and Messages need models that don't exist yet
 * (Phase D) and are deliberately left off rather than linking to a 404, same
 * discipline the HR & Payroll section above follows. A single flat list (no
 * section titles) so it maps directly onto the portal's bottom tab bar.
 */
const portalNavigation: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
      { label: "Timetable", href: "/portal/timetable", icon: CalendarClock },
      { label: "Attendance", href: "/portal/attendance", icon: ClipboardCheck },
      { label: "Fees", href: "/portal/fees", icon: Wallet, roles: ["parent"] },
      { label: "Transport", href: "/portal/transport", icon: Bus },
      { label: "Certificates", href: "/portal/certificates", icon: ScrollText },
    ],
  },
];

/**
 * Super Admin (platform-level) navigation — a third, separate IA alongside
 * adminNavigation/portalNavigation, since a Super Admin manages the SaaS
 * business (schools, not one school's records). Only lists what's actually
 * built — no links to unbuilt Billing/Support/etc. pages.
 */
const platformNavigation: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/super-admin", icon: LayoutDashboard },
      { label: "Schools", href: "/super-admin/schools", icon: School },
      { label: "Audit Log", href: "/super-admin/audit-log", icon: ScrollText },
    ],
  },
];

export function getPlatformNavigation(): NavSection[] {
  return platformNavigation;
}

function filterSections(sections: NavSection[], role: Role): NavSection[] {
  return sections
    .filter((section) => !section.roles || section.roles.includes(role))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}

export function getNavigationForRole(role: Role): NavSection[] {
  if (role === "parent" || role === "student") {
    return filterSections(portalNavigation, role);
  }
  return filterSections(adminNavigation, role);
}
