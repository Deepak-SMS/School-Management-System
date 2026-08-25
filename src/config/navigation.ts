import {
  LayoutDashboard,
  School,
  UserPlus,
  Users,
  UserCog,
  BookOpenCheck,
  Wallet,
  Landmark,
  MessagesSquare,
  IdCard,
  Library,
  Bus,
  BedDouble,
  Boxes,
  GraduationCap,
  BarChart3,
  Sparkles,
  Settings,
  ClipboardCheck,
  CalendarClock,
  FileText,
} from "lucide-react";
import type { NavSection } from "@/types/navigation";
import type { Role } from "@/types/user";

/** Full admin-side navigation tree. Filtered per-role at render time. */
const adminNavigation: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
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
      { label: "Student Documents", href: "/students/documents" },
      { label: "Student Promotion", href: "/students/promotion" },
      { label: "Student Transfer", href: "/students/transfer" },
      { label: "Alumni", href: "/students/alumni" },
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
  {
    title: "HR Management",
    icon: UserCog,
    roles: ["super_admin", "school_admin", "principal", "hr", "hr_staff", "hod", "accountant"],
    items: [
      { label: "HR Dashboard", href: "/hr" },
      { label: "Employees", href: "/employees" },
      { label: "Teaching Staff", href: "/employees/teachers" },
      { label: "Departments", href: "/school/departments", roles: ["super_admin", "school_admin", "principal", "hr", "hr_staff"] },
      { label: "Designations", href: "/hr/designations", roles: ["super_admin", "school_admin", "principal", "hr", "hr_staff"] },
      { label: "Employee Types", href: "/hr/employee-types", roles: ["super_admin", "school_admin", "hr", "hr_staff"] },
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
  {
    title: "Academics",
    icon: BookOpenCheck,
    roles: ["super_admin", "school_admin", "principal", "teacher"],
    items: [
      { label: "Attendance", href: "/academics/attendance", icon: ClipboardCheck },
      { label: "Timetable", href: "/academics/timetable", icon: CalendarClock },
      { label: "Subjects", href: "/academics/subjects" },
      { label: "Assignments", href: "/academics/assignments" },
      { label: "Homework", href: "/academics/homework" },
      { label: "Examinations", href: "/academics/examinations" },
      { label: "Gradebook", href: "/academics/gradebook" },
      { label: "Results", href: "/academics/results" },
      { label: "Report Cards", href: "/academics/report-cards" },
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
    title: "HR & Payroll",
    icon: Landmark,
    roles: ["super_admin", "school_admin", "hr"],
    items: [
      { label: "Employee Attendance", href: "/hr/attendance" },
      { label: "Leave", href: "/hr/leave" },
      { label: "Payroll", href: "/hr/payroll" },
      { label: "Payslips", href: "/hr/payslips" },
    ],
  },
  {
    title: "Communication",
    icon: MessagesSquare,
    roles: ["super_admin", "school_admin", "principal", "teacher"],
    items: [
      { label: "Notifications", href: "/communication/notifications" },
      { label: "SMS", href: "/communication/sms" },
      { label: "Email", href: "/communication/email" },
      { label: "WhatsApp", href: "/communication/whatsapp" },
      { label: "Push Notifications", href: "/communication/push" },
      { label: "Internal Messages", href: "/communication/messages" },
      { label: "Announcements", href: "/communication/announcements" },
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
    title: "Library",
    icon: Library,
    roles: ["super_admin", "school_admin", "librarian"],
    items: [
      { label: "Books", href: "/library/books" },
      { label: "Categories", href: "/library/categories" },
      { label: "Members", href: "/library/members" },
      { label: "Issue / Return", href: "/library/issue-return" },
      { label: "Fines", href: "/library/fines" },
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
      { label: "AI Analytics", href: "/ai/analytics" },
      { label: "AI Report Generator", href: "/ai/report-generator" },
      { label: "AI Communication Assistant", href: "/ai/communication-assistant" },
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

/** Separate, deliberately short IA for the parent/student portal (section 27). */
const portalNavigation: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "My School",
    items: [
      { label: "Timetable", href: "/portal/timetable", icon: CalendarClock },
      { label: "Attendance", href: "/portal/attendance", icon: ClipboardCheck },
      { label: "Results", href: "/portal/results", icon: FileText },
      { label: "Assignments", href: "/portal/assignments", roles: ["student"] },
      { label: "Fees", href: "/portal/fees", roles: ["parent"] },
    ],
  },
  {
    title: "Communication",
    icon: MessagesSquare,
    items: [{ label: "Messages", href: "/portal/messages" }],
  },
];

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
